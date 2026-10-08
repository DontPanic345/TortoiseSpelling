# Test layers and a web app for iPhone (planning doc, not yet implemented)

Status: **proposal**. Drafted 08/10/2026 from a planning conversation and revised the same
day: a native iOS app was considered and dropped (see [Why not native iOS](#why-not-native-ios)),
so the second codebase is a web app. Nothing here is built yet; this is the plan to
implement against. Items marked **(unverified)** are things I believe but haven't confirmed.

## Where things stand

- **Unit tests:** 19 JVM test files in `app/src/test/` (mostly `domain/` and parsing, plus
  a few UI-state helpers). One of them, `ClaudeIntegrationTest`, calls the live API and is
  skipped without a key. There are no ViewModel tests by name.
- **End-to-end:** `e2e/` has 9 Gherkin feature files, run by WebdriverIO + Cucumber through
  Appium's UiAutomator2 driver against the real APK. CI runs only `check-steps` and
  `typecheck` for it, because the scenarios need an emulator.
- **Gaps:** there is no `app/src/androidTest/` at all. That means no Room DAO tests, no
  component tests, and no migration tests. The 1→2 migration is untested even though Room
  has no destructive fallback and the word list is the one thing a user can't recreate.
  `androidx-room-testing` is already in `gradle/libs.versions.toml` but unused.

## Goals

- A **suite of suites**: one class of tests per layer of the app, each runnable on its own
  and each in its own CI job, instead of one undifferentiated pile.
- Behaviour-level tests written in Gherkin. **The runner is an implementation detail** and
  isn't a concern for now; the existing WebdriverIO + Cucumber setup stays for Android e2e
  until there's a reason to change it.
- Two codebases: the native Android app, and a web app so iPhone users (and anyone with a
  browser) can install it from a URL with no store, no Mac and no fee.

## Layers (Android)

| # | Layer | Tag | Covers | Runs on | Tooling |
|---|---|---|---|---|---|
| 1 | Unit | `@unit` | Pure logic: `domain/`, response parsing, UI-state mapping | JVM, no device | JUnit, coroutines-test (existing) |
| 2 | Data | `@data` | Room DAOs and queries, and every migration (1→2 first) against real SQLite | Emulator or device | `androidx.test`, `room-testing` |
| 3 | Component | `@component` | One screen alone with fake data: feedback on a wrong answer, buttons enabling, empty states | Emulator or device | Compose UI test APIs |
| 4 | Integration | `@integration` | UI + ViewModel + real repository together, with a fake clock: "answer correctly, and the word is due again in 6 days" | Emulator or device | Compose UI test APIs, injectable clock |
| 5 | End-to-end | `@e2e` | Whole-app journeys and device-only behaviour (permission prompt, notifications, document picker, process death) | Emulator, real APK | Appium (existing) |
| 6 | Specialised | by kind | Screenshot tests, accessibility checks, a release-build (R8) smoke run, the `@live-api` scenarios | Varies | Paparazzi or Roborazzi, accessibility checks |

Notes on the layers:

- Keep the pyramid shape: lots of 1, few of 5. The existing `e2e/README.md` rule stands:
  rules and edge cases belong in unit tests, and a new e2e scenario should be a new journey.
- Layer 4 needs the clock injectable. Dates are epoch days from `domain/Days.kt`, so this is
  mostly a matter of passing "today" in rather than reading it.
- Layer 6's R8 smoke run follows from the CLAUDE.md warning that anything reflective can
  work in debug and break in release. `APK=... npm run e2e` already supports a release build.
- Selecting a layer: one package per layer under `androidTest` (`.data`, `.component`,
  `.integration`), run with the instrumentation runner's `package` argument, or an
  annotation filter. Each layer gets its own Gradle task or CI job and is documented in
  `CLAUDE.md`.

## Gherkin

- Gherkin is the language; Cucumber is one runner for it. Decision (08/10/2026): the runner
  doesn't matter, so don't spend effort replacing it.
- Use Gherkin for behaviour, written in the user's voice, as `e2e/README.md` describes.
  Keep pure algorithms (SM-2 intervals, fuzzing, diffs) as table-driven unit tests, where
  Gherkin would be ceremony.
- Shared specs: once the web app exists, move `e2e/features/` to a root `specs/` folder and
  tag scenarios by layer (`@component`, `@e2e`) and, where behaviour differs, by platform
  (`@android`, `@web`). The same scenarios then run against the APK through Appium and
  against the web app through Playwright, which shows the two apps behave identically.
  That is the main payoff of having two codebases.

## Web app (PWA)

A web app installed to the Home Screen, in its own codebase. Proposed home: a `web/` folder
in this repo, so the specs can be shared (alternative: a separate repo). TypeScript is the
assumed language. The UI framework is an open question; no wrapper such as Capacitor, since
the point is a plain web app.

| Android | Web |
|---|---|
| Jetpack Compose | The web UI framework (open question) |
| ViewModel + `StateFlow` | Plain stores or framework state |
| Room | IndexedDB (through a small wrapper such as Dexie or idb) |
| `Sm2Scheduler`, `SessionBuilder`, `SpellingDiff`, `WordBlank` | Ported to TypeScript; the Kotlin unit tests become golden test cases |
| OkHttp to the Messages API | `fetch`, still no SDK |
| `SecretCipher` (Keystore) | Web Crypto (AES-GCM), which protects the key less well than Keystore |
| WorkManager daily reminder | Web Push from a small server (see below) |
| Versioned JSON backup (`data/Backup.kt`) | Same JSON format, so a backup can move between Android and web (needs checking against `Backup.kt`) |
| `TestTags.kt` | `data-testid`, mirrored the same way |
| Debug-only `SeedWordsActivity` | A debug hook that seeds words |

Tests for the web app mirror the layers above: Vitest for unit and component tests, and
Playwright for end-to-end, both assumed **(unverified)**. Playwright's WebKit engine isn't
iOS Safari, so the Home Screen install flow and the push permission prompt can only be
checked by hand on a real iPhone.

### Installing and notifications on iPhone

- **Install:** Safari, Share, Add to Home Screen. With a web app manifest whose `display` is
  `standalone`, it opens full-screen like an app. There's no store step.
- **Push:** supported on iPhone since iOS 16.4, but only for web apps installed to the Home
  Screen, with the permission prompt triggered by a user tap. Delivery goes through Apple's
  push service, and no Apple Developer membership is needed. Source:
  [WebKit's announcement](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
- **Offline:** a service worker caches the app so it works without a connection after the
  first load, matching the Android app's offline behaviour.

### Points that don't map one to one

- **Reminder needs a server.** As far as I know a web app can't schedule a local
  notification the way a native app can, so something has to send the push at the right
  time. Keep it minimal: the app sends its push subscription and its next due dates, never
  the words, and a small scheduled job sends the notification. Free serverless tiers
  probably cover it **(unverified)**. This is the feature the app exists for, so it deserves
  its own design before any code. Android's "only when words are due" rule has to be
  re-expressed as "send only on days the app has said words are due".
- **Privacy.** A push server stores subscription endpoints and due dates, which `PRIVACY.md`
  doesn't currently describe. That file needs updating before the web app ships with push.
  Shipping first without push, with an in-app "due today" on Home, is an option.
- **Storage is less durable** than a native database. I believe Home Screen web apps are
  exempt from Safari's 7-day cleanup of site storage **(unverified)**, but the backup export
  should be prominent.
- **Claude lookup from a browser** puts the API key in the browser and needs the API to
  allow direct browser calls **(unverified)**.
- **Fuzz.** Make the interval fuzz injectable so ported tests are deterministic.

## Cost and distribution

- **Android** stays free to ship: signed APKs on GitHub Releases, no store listing.
- **Web:** hosting is just static files; GitHub Pages is free for a public repo **(unverified)**.
  No Mac, Apple ID or weekly refresh, and no fee. The only running cost would be the push
  server, if any.

### Why not native iOS

Considered on 08/10/2026 and dropped. From Apple's
[membership comparison](https://developer.apple.com/support/compare-memberships/):

- **Free Apple Account:** on-device testing as a "Personal Team", up to 10 App IDs and 3 test
  devices per platform, with the profile and app expiring after 7 days. App distribution,
  App Store Connect and ad hoc distribution are paid-only.
- **Apple Developer Program:** US$99 per membership year (or local currency where available).
- **Sideloaders:** AltStore, SideStore and Sideloadly sign an app with each user's own free
  Apple ID. They need setup on a computer (or, for SideStore, a local VPN trick), a weekly
  refresh, and a third-party sign-in to Apple, and AltStore's marketplace edition is limited
  to the EU and Japan. Fine for technical users, not for a general audience.
- Building native iOS also needs macOS and Xcode, which the Windows-based dev setup in
  `CLAUDE.md` doesn't have.

## Suggested order

1. Fill the Android gaps first: add `room-testing`, write the 1→2 migration test and DAO
   tests under `androidTest/`.
2. Add the layer packages, tags and per-layer Gradle tasks, and document them in `CLAUDE.md`.
3. Web app: port `domain/` and its tests first as a plain TypeScript module (fast to verify),
   then storage, then the UI, then offline support.
4. Move the specs to `specs/`, add the platform tags, and run them through Playwright.
5. Reminders last: design the push server, update `PRIVACY.md`, then build it.

## Open questions

- The web UI framework, and whether `web/` lives in this repo.
- Where the web app is hosted, and under what address.
- Whether the first web release ships without push.
- Where the push server runs, if it ships at all, and what it stores.
- Whether the backup JSON should be shared between the two apps from the start.
