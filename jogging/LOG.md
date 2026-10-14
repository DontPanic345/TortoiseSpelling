# Jogging log

Newest at the bottom. One entry per step: date, piece/step, model, outcome.

## 2026-10-12 17:24 icon/spec (opus)
Wrote `jogging/specs/icon.md`. The generator is a dependency-free Node script emitting
VectorDrawables and an SVG preview rather than Pillow rasters, so CI can check the committed
icons match the script. Added build-1 (generator and art), build-2 (device, release build,
docs) and review, all Sonnet.

## 2026-10-13 00:18 icon/spec-review (opus)
Spec holds up against the goals and the code. Fixed: `main` must not run on import, or the
drift test regenerates before comparing and can never fail; the notification gap limit is
now a tested constant; the group transform is pinned down; the preview recipe works around
headless Edge's minimum window width; CLAUDE.md's "release script tests" wording joins the docs list.

## 2026-10-13 00:23 test-data-layer/spec (opus)
Wrote `jogging/specs/test-data-layer.md`. Layers are selected by the runner's `package`
argument rather than custom Gradle tasks; `DATABASE_VERSION` and `ALL_MIGRATIONS` let a chain
test cover every migration from v1; CI adds an API 26 (minSdk, oldest SQLite) emulator job,
and connected runs must set `ANDROID_SERIAL` since they uninstall the app. Added build-1
(scaffolding, migration tests), build-2 (DAO, repository tests), build-3 (CI, docs) and review, all Sonnet.

## 2026-10-13 00:25 test-data-layer/spec-review (opus)
Spec holds up against the goals and the code. Fixed: ordering tests must set distinct
`createdAt` (it defaults to the clock); a fallback if the Room plugin won't apply under AGP 9;
a test-only database name; a job timeout so a hung emulator can't stall a release; build-3
watches the CI run for its own commit; corrected why `internal` members are visible.

## 2026-10-13 00:32 test-ui-layers/spec (opus)
Wrote `jogging/specs/test-ui-layers.md`. A `java.time.Clock` (`DeviceClock`, which follows zone
changes) and a `fuzz` function reach the repository and ViewModels through `AppContainer`; Review,
Home and the word list split into stateless `XContent`; integration tests drive the real NavHost
with a `LocalAppContainer` and a test clock. Screenshots use Google's Compose screenshot plugin
(Paparazzi is shaky on Gradle 9); a `@release-smoke` e2e journey runs on an R8 build from
`release.yml`. Added build-1 to build-7 and review, all Sonnet (build-6 high effort).

## 2026-10-13 10:24 test-ui-layers/spec-review (opus)
Spec holds up against the goals and the code. Fixed: integration tests seed before a new
`launch()` (Home loads once on creation); build steps follow the cloud rules (the phone via
`ANDROID_SERIAL`, only the covering e2e features, named per step); screenshot references are
recorded on Linux with CI authoritative; the accessibility CI layer runs on API 34, since the
checks may silently no-op on API 26; `ReviewContent` takes its title from `state.practiceMode`.

## 2026-10-13 10:34 word-forms/spec (opus)
Wrote `jogging/specs/word-forms.md`. Part of speech sits on the definition, and the base form is
`definitions[0].forms[0]` by position. `MIGRATION_2_3` rebuilds `words`, so one migration test
runs through Room's own open path to catch a cascade into `review_log`. `shownAt` is stamped when
a card is first shown, in practice too. The refresher now appends an example until `drop-api-key`.
Backups keep version 1, with a `definitions` tree beside the flat root-card fields so older
builds still import them. Added build-1 to build-4 and review, all Sonnet (build-1, build-3 and
review at high effort).

## 2026-10-13 10:37 word-forms/spec-review (opus)
Spec holds up against the goals and the code (review_log's cascade FK, Room 2.8, the existing
e2e steps). Fixed: the second rotation journey needs `nextDay()`, since a miss makes the word
due tomorrow; the migration nulls a blank part of speech and `hint` skips blank parts, so
imported `""` values can't show a stray " · "; an edit save re-reads the word before writing the whole row.

## 2026-10-13 10:43 copy-prompt/spec (opus)
Wrote `jogging/specs/copy-prompt.md`. The prompt and a `JsonElement` parser with exact messages
and limits are pure in `domain/` for the web port; the JSON is located between the outer braces
(fences and prose), validated as it's pasted into a dialog, and Use this replaces the editor's
word and content, confirming a spelling change. Look up with Claude and its live-api scenarios go;
Settings' key section now says it's only for keeping cards fresh. Added build-1 to build-3 and
review, all Sonnet (build-2 and review at high effort).

## 2026-10-13 10:45 copy-prompt/spec-review (opus)
Spec holds up against the goals and the code (the add screen, blankWordIn, the e2e steps it reuses).
Fixed: the per-definition checks run as one pass in document order, with limits after it and before
the base form is added, so both platforms report the same first failure; parsing uses the strict
default `Json` to match `JSON.parse`; `addWord.save()` scrolls Save into view, since a pasted tree pushes it off screen.

## 2026-10-13 10:51 drop-api-key/spec (opus)
Wrote `jogging/specs/drop-api-key.md`. `SettingsStore` deletes an earlier version's encrypted key
and its Keystore entry once; the Internet permission and OkHttp go; `MIGRATION_3_4` drops
`autoRefresh`/`refreshedOn` with `MIGRATION_2_3`'s rebuild and Room-path test; backups drop the two
keys and stay version 1; Settings splits into `SettingsContent`. Added build-1 to build-4 and review,
all Sonnet (build-1, build-3 and review at high effort).

## 2026-10-13 10:54 drop-api-key/spec-review (opus)
Spec holds up against the goals and the code (SettingsStore, SecretCipher's alias, the Settings sections, the e2e key steps).
Fixed: `PRIVACY.md`'s new opening no longer claims only the chat paste leaves the phone (Google backup and Export
stay); `.gitignore` keeps `apikey` so a stray local key file can't be committed; the key is deleted on the first
run after the update, checked every start so restored backups are cleaned; build-4's grep allow-list is complete.

## 2026-10-13 10:59 web-core/spec (opus)
Wrote `jogging/specs/web-core.md`. Golden cases are JSON in a root `golden/` folder, run by a JUnit
runner (the oracle) and a Vitest runner; random functions are checked as allowed sets over seeds, and
`ktTrim` copies Kotlin's whitespace rules. Words live in IndexedDB (`idb`) with their content nested,
the DAO queries become pure functions, and the repository mirrors `WordRepository` with one
transaction per write. Added build-1 to build-4 and review, all Sonnet (build-3 medium, the rest high).

## 2026-10-13 17:18 web-core/spec-review (opus)
Spec holds up against the goals and the code (WordRepository, the DAO queries, Backup.kt, SettingsStore).
Fixed: backup `createdAt`/`exportedAt` default to the clock, so cases say `"now"` and `parseBackup` takes `now`;
quoted numbers and booleans are settled against kotlinx; unsafe-integer Longs and U+0130 lowercasing are handled;
duplicate checks run inside the write transaction, with the IndexedDB auto-commit trap spelt out; CI's `cache: npm`.

## 2026-10-13 17:27 web-ui/spec (opus)
Wrote `jogging/specs/web-ui.md`. Preact on Vite, with hash routes, `XScreen`/`XContent` and pure `<name>State.ts`
mirroring the Android split, a `Platform` seam for clipboard, file save, storage and install, Android's copy and its
test-tag values as `data-testid` (checked by a parity test), and `golden/ui.json` for the screen helpers. Also a
hand-written service worker, a CSP limiting the app to its own origin, a Playwright smoke suite in Chromium and WebKit,
and `pages.yml`. Pages has to be enabled once by Alan; build-7 blocks on that only if the deploy fails. Added
build-1 to build-7 and review, all Sonnet (build-1, 3, 4, 6 and review at high effort).

## 2026-10-13 17:30 web-ui/spec-review (opus)
Spec holds up against the goals and the code (ReviewViewModel, TestTags.kt, SettingsViewModel's import message, web-core's repository).
Fixed: review transitions return a list of effects, since a correct first try both records and auto-advances; the router
uses pushState with a depth and notifies itself (pushState fires no hashchange); export falls back to download when Safari
refuses a late share; Copy prompt writes before any await; jsdom stubs for dialog and scrollIntoView; SW registration lives
in browserPlatform; `lastExportedAt` gets its repository calls; `filterRows` may already be moved by word-forms.

## 2026-10-13 17:39 shared-specs/spec (opus)
Wrote `jogging/specs/shared-specs.md`. Features move to `specs/` with `@e2e` on each (the only layer tag: lower layers have
their own frameworks) and `@android`/`@web` only where the platform forbids it, with a reason comment, all checked by
`scripts/check-specs.mjs`. The web runs them through `playwright-bdd` against a `--mode e2e` build with a seed hook, in
Chromium and WebKit, inside `web.yml`. Added build-1 to build-3 and review, all Sonnet (build-1 medium, the rest high).

## 2026-10-13 17:43 shared-specs/spec-review (opus)
Spec holds up against the goals and the code (the e2e runner, web-ui's Playwright setup, playwright-bdd 9.2.1's source).
Fixed: `featuresRoot: "../specs"` is required, or `bddgen` exits on features outside `web/`; `--unused-steps` exists but
exits 0, so check-steps parses its output; clipboard permissions on the Chromium project only; the seed hook checks `kind`;
web typecheck covers `steps/` and the shared fixtures; "go back to Home" also takes Done and asserts Home; the review grep skips `.git`.

## 2026-10-13 17:54 web-push/spec (opus)
Wrote `jogging/specs/web-push.md`. The server is a Cloudflare Worker (free plan) with a 5-minute cron and a SQLite Durable
Object storing only subscriptions, zone, time, the next due day and the last sent day; pushes carry an encrypted
`reminder`/`test` kind and the service worker (now TypeScript) counts the plan on the device. Quiet days are backfilled
on the next open for streak parity. The Cloudflare account is Alan's to create, so build-4's deploy blocks on it only.
Added build-1 to build-4 and review, all Sonnet (build-4 medium, the rest high).

## 2026-10-13 18:05 web-push/spec-review (opus)
Spec holds up against the goals and the code (ReminderWorker, ReminderScheduler, notifications.feature, web-core/web-ui/shared-specs).
Fixed: the smoke's sending case registered after its time, which `sentDayOnRegister` marks sent, so it now registers for the
next minute and waits; `settleQuietDays` runs in `main.tsx` before render (a `#/review` launch could otherwise hide a skipped
day), never notifies, and marks only while `reminderEnabled` (Android's worker); a dismissed prompt turns reminders off
silently; the test button re-registers on a 404; the service worker syncs after a reminder push; the e2e fakes are spelt out.

## 2026-10-13 18:30 icon/build-1 (sonnet)
Wrote `scripts/icon.mjs` (dependency-free; shapes → launcher, themed and notification vector drawables, background colour and
`docs/icon.svg`) and `scripts/icon.test.mjs` (drift, safe circle, width ≥ 52, notification box, gap ≥ 1 unit, plate and shell
separation, single-colour, eye hole). Deleted the 15 WebPs. Shell plates come from clipping a dome polygon against offset cut
lines. No Edge here, so I rendered the paths with ImageMagick `-draw` to check the art. `node --test`, `assembleDebug`,
`testDebugUnitTest` and `lintDebug` pass; the generator is idempotent and a colour edit fails the drift test.

## 2026-10-13 18:50 icon/build-2 (sonnet)
On the Galaxy S23 (debug and debug-keystore release builds): the launcher icon, the status-bar silhouette and the shade
notification all show the new tortoise, and the release build (R8, shrinking) still resolves them. Not checked: themed icons,
because One UI exposes them only through Theme Park. Updated CHANGELOG, CLAUDE.md (icons note, `icon.mjs` command, "script
tests") and todo. Script tests, unit tests, lint, check-steps and typecheck pass. The e2e run did not complete: the 20 MB APK
install over Tailscale takes about 3 minutes, past Appium's 120 s adb timeout and cucumber's 120 s step timeout ("freshly
installed" step), so the `review` step needs those raised or the APK preinstalled; nothing in this step touches app logic.

## 2026-10-13 19:25 icon/review (sonnet)
Reviewed against the spec and goals: no WebPs left, generated files match the script, script tests (30), unit tests, lint and `assembleRelease` pass, no
stray comments in `icon.mjs`, docs updated. Bumped to 0.4.0 (versionCode 5). The e2e timeouts were raised upstream meanwhile (kept theirs) so the APK
install over Tailscale completes. The full e2e run on the S23 still had 4 failures: the "I am told the correct word" steps (the Correct card auto-advances after
~1.1s, too fast to observe over the link; reproduced alone in review.feature), one backup import toast, and one SeedWordsActivity timeout. No app logic changed in
this piece; those steps want a link-tolerant check. Themed icon still unchecked on-device (One UI).

## 2026-10-13 20:05 test-data-layer/build-1 (sonnet)
Room Gradle plugin, androidTest deps, `DATABASE_VERSION`/`ALL_MIGRATIONS`, `TestWords.kt` and `MigrationTest` (3 tests) added; the plugin leaves `app/schemas` clean.
Build, unit tests, lint and `assembleDebugAndroidTest` pass; the 3 tests pass on the S23 (XML, HTML report, and `am instrument` by hand), and the mutations (drop the `refreshedOn` ALTER; empty `ALL_MIGRATIONS`) fail 3 and 1 tests. e2e `add_word.feature` passes.
Oddity: `connectedDebugAndroidTest` exits "There were failing tests" on the S23 even though every test passed (test-result-exit-code 1, no failure recorded; tried `--rerun`, legacy UTP flag). Cause unknown, probably the UTP post-run steps over the Tailscale adb link; use install + `am instrument` here, and watch for it on the CI emulator in build-3.

## 2026-10-13 20:16 test-data-layer/build-2 (sonnet)
Added `TortoiseSpellingDaoTest` (17 tests: every query, unique index, cascade and FK refusal) and `WordRepositoryTest` (4: add, rename duplicate, import merge, stale-snapshot `recordReview`). Unit tests, lint and `assembleDebugAndroidTest` pass; all 24 data-layer tests pass on the S23 via install + `am instrument` (gradle connected task not used, per build-1's note). Mutating `dueWords` to `<` fails the DAO test (and `MigrationTest`); reverted. No app bugs found, so no CHANGELOG line or e2e.

## 2026-10-13 20:40 test-data-layer/build-3 (sonnet)
Added the `data` job to `ci.yml` (API 26, x86_64, KVM enabled, 45 min timeout, report upload on failure; header comment updated) and the CLAUDE.md and testing-plan docs. Not verified: this cloud session has no working `gh` login, so I couldn't watch the run. The `review` step must check the `data` job is green on main and that it ran 24 tests; if the connected task's exit-code oddity from build-1 shows up on the emulator, fix it there.

## 2026-10-13 23:30 test-data-layer/review (sonnet)
Reviewed against the spec and goals: `ALL_MIGRATIONS`/`DATABASE_VERSION` drive the chain test, schemas are clean, docs match the commands, no stray comments. Unit tests, lint and `assembleDebugAndroidTest` pass; all 24 data-layer tests pass on the S23 (`am instrument`). The `data` job in main's CI run for build-3 is green on API 26 and the connected task exited 0 there, so build-1's exit-code oddity is specific to the phone link. No version bump (test-only).
Note: the phone still had build-2's `<` mutation installed (and a differently signed app), which made two tests fail until I uninstalled and reinstalled; future cloud sessions seeing odd failures should reinstall first.

## 2026-10-14 00:40 test-ui-layers/build-1 (sonnet)
Injectable clock and fuzz as specified: `Days.today(clock)`, `DeviceClock`, `WordRepository(clock, fuzz)`, `SettingsStore(fileName)`, `AppContainer` parameters, `HomeUiState.today` feeding `CompletionPanel`, `LocalAppContainer`; `DaysTest` gained 2 tests. Build, unit tests, lint, `assembleDebugAndroidTest` and the spec's grep pass; the 24 data-layer tests pass on the S23; e2e daily_allowance, word_list and add_word pass.
Oddity: on the S23 the e2e `review.feature` (2 scenarios) and `completion.feature` (the "practised today's words" Given) fail at "correct word" because the ~1.1s hit card has already auto-advanced by the time Appium reads it over the Tailscale link. The unmodified code fails review.feature identically (24 pass, 2 fail, twice), so it's link latency, not this step; the `review` step should expect it, or the steps could be made less timing-bound.

## 2026-10-14 01:20 test-ui-layers/build-2 (sonnet)
Split `ReviewContent`, `HomeContent` and `WordListContent` out of their screens (pure move), added the Compose UI test dependencies and 36 component tests (Review 12, Home 10, WordList 6, CompletionPanel 8); CLAUDE.md has the command, layer row and Layers convention. Build, unit tests, lint and `assembleDebugAndroidTest` pass; all 36 tests pass on the S23 (gradle's connected task still exits "failing tests" there with 0 failures, as in test-data-layer/build-1). Mutations caught: Check enabled on blank fails `checkIsDisabledUntilSomethingIsTyped`, dropping `ending` fails `theLastCorrectWordHasNoButton`; both reverted.
e2e: daily_allowance and word_list pass; review and completion fail only at the "correct word"/"practised correctly" steps (hit card auto-advances over the Tailscale link), same as before this step. Row status tags need `useUnmergedTree = true` in tests since rows are merged clickable nodes.

## 2026-10-14 03:00 test-ui-layers/build-3 (sonnet)
Added `TestClock`, `AppHarness` and the five journey tests (scheduling, lapse, practice, allowance, streak) in `androidTest/.../integration`, and the CLAUDE.md command and layer row. Unit tests, lint and `assembleDebugAndroidTest` pass; all 5 pass on the S23 via install + `am instrument`. Mutations: SM-2 `2 -> 5` fails SchedulingJourneyTest; removing `markTodaySatisfied()` fails StreakJourneyTest alone; both reverted. No app bug found, no e2e needed.
Spec corrections: `TortoiseSpellingNavHost` is public, not `internal` (the test APK hits IllegalAccessError on an internal composable at runtime). Seeded definitions must not contain the word, since `addWord` scrubs it.

## 2026-10-14 15:30 test-ui-layers/build-4 (sonnet)
Added `ui-test-junit4-accessibility`, a shared `component/Fixtures.kt`, and `ScreenAccessibilityTest` (10 states × light/dark = 20 tests); CLAUDE.md has the command and layer row. Build, unit tests, lint and `assembleDebugAndroidTest` pass; accessibility (20) and component (36) pass on the S23 via `am instrument`. Mutation: `contentDescription = null` on "End session" fails the 7 review tests (light and dark appear in the output); reverted.
Spec correction: Compose 1.12.1 has no `tryPerformAccessibilityChecks`; once `enableAccessibilityChecks(validator)` is on, every action runs the checks, so the test does an empty `onRoot().performTouchInput { }`.
Findings fixed in the app (CHANGELOG `### Fixed`): light-theme text contrast of the diff highlight (`CorrectGreen` 2E7D52 -> 1B5E3A, highlight alpha 0.35 -> 0.2, ReviewScreen `DiffRow`). Suppression: TouchTargetSizeCheck on unlabelled elements (no text, no description) — Home's "See all" button reports a 13dp unlabelled sliver while the labelled button node passes; labelled controls are still checked.
e2e review.feature: same 2 known "Correct" auto-advance failures over the link (not caused by the colour change). Fixtures.kt is not yet used by the component tests (they keep their private copies).

## 2026-10-14 02:24 test-ui-layers/build-5 (sonnet)
Added the screenshot plugin (alpha16), 9 states + CompletionPanel in light and dark (20 previews) in `screenshotTest/`, committed Linux-recorded references, the `screenshots` CI job and CLAUDE.md command/row. `validateDebugScreenshotTest`, unit tests and lint pass; I looked at the references (dark is dark, nothing blank; the word list's filter chip row scrolls off the edge by design). Mutation: changing the CompletionPanel title fails 4 screenshots; reverted.
Not done: couldn't watch CI (no working `gh` login), so the `screenshots` job is unverified; `review` should check it. `imageDifferenceThreshold` doesn't exist in the AGP 9.4 DSL, so it's left at the exact default.

## 2026-10-14 16:40 test-ui-layers/build-6 (sonnet)
Added `release_smoke.feature` (`@release-smoke`, existing steps only), `npm run e2e:release`, `not @release-smoke` in `DEFAULT_TAGS`, `release-smoke.yml` (API 34, throwaway keystore) and the `smoke` job that `build-and-release` now needs in `release.yml`; e2e/README, README and CLAUDE.md updated. `check-steps -- --all`, `typecheck` and default `check-steps` (15 scenarios, no smoke) pass; the debug-keystore `assembleRelease` builds.
On the S23 the release APK passes every step except "I am told the correct word" (the known Correct-card auto-advance vs. link latency); with only that step removed locally, all 19 others pass, including the test notification, the session and the backup export and import under R8. The step stays in the committed feature.
Not done: no working `gh` login here (invalid GH_TOKEN), so `release-smoke.yml` was never dispatched and the Appium-on-CI-emulator rounds are unverified. `review` must dispatch it (`gh workflow run release-smoke.yml --ref main`), fix emulator or Appium problems, and record any YAML departures in the spec.

## 2026-10-14 18:00 test-ui-layers/build-7 (sonnet)
`ci.yml`: the `data` job is now the `instrumented` matrix (data, component, integration on API 26; accessibility on API 34; fail-fast off, per-layer package and report names), the header comment lists what runs, and the screenshot job also uploads its results folder. CLAUDE.md's CI bullet and the plan doc's "Where things stand" (layer counts, gaps) updated. Script tests (30), unit tests, lint and a YAML parse pass.
Not done: no working `gh` login (invalid GH_TOKEN), so the CI run and the per-job test counts (data 24, component 36, integration 5, accessibility 20 runs) are unverified; `review` should check the latest run on main.

## 2026-10-14 20:30 test-ui-layers/review (sonnet)
Reviewed against the spec and goals: build-1's grep prints only the allowed `currentTimeMillis` defaults, the reminder code is untouched, no sleeps in androidTest. Unit tests, lint, `validateDebugScreenshotTest`, script tests and `assembleDebugAndroidTest` pass; on the S23 data 24, component 36, integration 5 and accessibility 20 all pass. Full e2e: only the known link failures (the "correct word" auto-advance, one SeedWordsActivity timeout in notifications.feature); nothing attributable to this piece.
NOT finished: the `node scripts/bump-version.mjs patch` (0.4.1, for build-4's contrast fix) was denied by the session's permission classifier as a production deploy, so the step stays `pending`. The next session should run the bump, commit and push, then mark the piece done. Also unverified: no working `gh` login, so main's CI, the `screenshots`/`instrumented` jobs and `release-smoke.yml` were not checked.
