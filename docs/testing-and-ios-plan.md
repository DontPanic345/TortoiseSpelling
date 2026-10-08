# Test layers and an iOS port (planning doc, not yet implemented)

Status: **proposal**. Drafted 08/10/2026 from a planning conversation. Nothing here is
built yet; this is the plan to implement against. Items marked **(unverified)** are things
I believe but haven't confirmed.

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
  isn't a concern for now; the existing WebdriverIO + Cucumber setup stays for e2e until
  there's a reason to change it.
- A native iOS app in a separate codebase, with the same behaviour as the Android app.

## Layers

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
- Shared specs: when a second layer or iOS needs the same scenarios, move
  `e2e/features/` to a root `specs/` folder and tag scenarios by layer (`@component`,
  `@e2e`) and, where behaviour differs, by platform (`@android`, `@ios`). One spec then
  shows the two apps behave identically, which is the main payoff of having two codebases.

## iOS app

Native Swift and SwiftUI, in its own codebase. No Capacitor, React Native or other shared
runtime. Proposed home: an `ios/` folder in this repo, so the specs can be shared
(alternative: a separate repo).

| Android | iOS equivalent |
|---|---|
| Jetpack Compose | SwiftUI |
| ViewModel + `StateFlow` | `@Observable` view models (iOS 17+) |
| Room | SwiftData (iOS 17+), or GRDB / Core Data for older targets |
| `Sm2Scheduler`, `SessionBuilder`, `SpellingDiff`, `WordBlank` | Ported to Swift; the Kotlin unit tests become golden test cases |
| OkHttp to the Messages API | `URLSession`, still no SDK |
| `SecretCipher` (Keystore) | Keychain |
| WorkManager daily reminder | Local notifications (see below) |
| Versioned JSON backup (`data/Backup.kt`) | Same JSON format, so a backup can move between platforms (needs checking against `Backup.kt`) |
| `TestTags.kt` | `accessibilityIdentifier`, mirrored the same way |
| Debug-only `SeedWordsActivity` | A debug launch argument that seeds words |

Points that don't map one to one:

- **Reminder.** Android's reminder fires "only when words are due". An iOS local
  notification can't run code when it fires, so a conditional reminder means scheduling
  ahead from the known due dates, and rescheduling after every session and every launch.
  This is the feature the app exists for, so it deserves its own design before any code.
- **Cloud backup switch.** iOS backs app data up to iCloud by default. There's no direct
  equivalent of the off-by-default `cloudBackupEnabled` switch; the closest is excluding
  files from backup. Needs a decision.
- **Fuzz.** Make the interval fuzz injectable so ported tests are deterministic.

**Can't be built here.** The environment this plan was drafted in is Linux with no Xcode,
so Swift written there can't be compiled or tested. Any iOS work needs a macOS machine or
a macOS CI job from the first commit. GitHub-hosted macOS runners are free for public
repos **(unverified)**.

## Cost and installing on an iPhone

From Apple's [membership comparison](https://developer.apple.com/support/compare-memberships/),
checked 08/10/2026:

- **Free Apple Account:** Xcode, plus on-device testing as a "Personal Team". Up to 10 App
  IDs and 3 test devices per platform, and the profile and app expire after 7 days, so the
  app has to be rebuilt and reinstalled weekly. App distribution, App Store Connect and ad
  hoc distribution are listed as paid-only.
- **Apple Developer Program:** US$99 per membership year (or local currency where
  available). It adds App Store distribution and App Store Connect. The page doesn't mention
  TestFlight; I believe it comes with App Store Connect access but haven't confirmed.

What that means here:

- **Android** stays free to ship: signed APKs on GitHub Releases, no store listing.
- **iOS for yourself is free,** but Xcode only runs on macOS, and `CLAUDE.md` describes a
  Windows machine, so a Mac (or a cloud Mac) is needed to sign and install through Xcode.
- **A Windows route may work (unverified):** CI builds an unsigned IPA on a macOS runner,
  and a third-party sideloader such as AltStore or Sideloadly re-signs it with a free
  Apple Account and refreshes it weekly. Check that these tools still work on current iOS
  before relying on it.
- **iOS for other people is not free.** There's no free way to distribute, so a public iOS
  release means the paid programme.

## Suggested order

1. Fill the Android gaps first: add `room-testing`, write the 1→2 migration test and DAO
   tests under `androidTest/`.
2. Add the layer packages, tags and per-layer Gradle tasks, and document them in `CLAUDE.md`.
3. Decide whether the specs move to `specs/`, and settle the platform tags.
4. iOS: port `domain/` and its tests first as a plain Swift package (fast to verify on a
   macOS CI job), then data, then the UI, then the reminder.
5. Point the Appium suite at the iOS build with the XCUITest driver, and add the
   `accessibilityIdentifier`s and debug seeding it needs.

## Open questions

- Minimum iOS version (SwiftData and `@Observable` both want iOS 17).
- `ios/` in this repo, or a separate repo.
- The iOS reminder design, and what to do about the cloud backup switch.
- Whether a Mac is available, or the CI-plus-sideloader route is the plan.
- Bundle identifier for the iOS app.
