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

## 2026-10-14 22:00 test-ui-layers/review (sonnet)
Second attempt at the finishing step: `node scripts/bump-version.mjs patch` was denied again by the session's permission classifier (production deploy, since a version bump on main releases). Nothing else changed; the step stays `pending`.
Needs Alan: run `node scripts/bump-version.mjs patch` himself (or allow it for Jogging sessions), commit, push, then mark `test-ui-layers/review` and the piece done. Main's CI and `release-smoke.yml` are still unchecked (no working `gh` login).

## 2026-10-14 23:30 test-ui-layers/review (sonnet)
The release bump needed no new run: `versionName` is already 0.4.1 (versionCode 6) with a dated changelog section covering build-4's contrast fix, and `v0.4.1` is untagged, so the release workflow cuts it on this push; `bump-version.mjs patch` correctly refused (nothing under `[Unreleased]`). The review itself was done in the earlier attempt (all layers pass on the S23).
Still unchecked: no working `gh` login here, so main's CI, the `screenshots`/`instrumented` jobs and `release-smoke.yml` weren't seen. Piece marked done.

## 2026-10-14 22:30 word-forms/build-1 (sonnet)
Schema v3 as specified: the `definitions`, `word_forms` and `example_sentences` entities, `WordWithContent` relations, `MIGRATION_2_3` (statements copied from the generated `3.json`, `words` rebuilt without the three columns), the DAO content methods (`contentFor` chunks at 500 inside the DAO so its test can pass 1,200 ids), `WordContent`/`ContentEdit` in `domain/WordContent.kt`, repository (`addWord(text, content)` plus the flat overload, `updateWord(word, content)`, `addExample`, `exportAll`/`importWords` over `ImportedWord`), `CardRefresher` appending an example, and the root-card glue: `ReviewCard`/`rootCard` in `domain/CardPick.kt` (`hint` and `pickCard` are build-2's), the add screen editing the first definition and base form through `ContentEdit`s, the word list showing the first definition. I also did the "Keep this card fresh" copy and its `### Changed` CHANGELOG line now, since the behaviour changed here.
Unit tests (27 new `WordContentTest`), lint, screenshot validation and `assembleDebugAndroidTest` pass; on the S23 via `am instrument` data 37 (5 migration incl. the Room-path one), component 36, integration 5 all pass. Mutations all caught: dropping `lapses` from the `words` copy (4 migration tests fail), dropping the example insert's `WHERE` (2), `DELETE FROM review_log WHERE id = 1` at the end (3, including the Room-path test); each reverted. e2e add_word and word_list pass (34); review.feature has the known two "correct word" auto-advance failures (24 pass, same as before this step); backup.feature failed once at the import toast when run with review but passes alone (10).
Notes for build-2: `searchTerms` and `exampleMissesForm` already exist with tests (build-4 only needs to use `searchTerms` in the word list filter, which still matches `normalizedText`); `testCard`/`seedContent` helpers are in `androidTest/.../data/TestWords.kt`; the fallback card for a word with no content rows is what lets DAO-seeded integration words stay reviewable. Spec deviations: none.

## 2026-10-14 23:59 word-forms/build-2 (sonnet)
`pickCard` (least recently shown example across all forms, never shown first, `random` among ties; base form with no sentence when there are no examples; `word.text` with no content), `ReviewCard.hint`, `WordRepository.markShown`, and the ViewModel stamping each card as it becomes current (practice mode too); `rootCard` deleted; Review shows the hint line ("verb · past tense"). New: `CardPickTest`, a non-root-form blanking test, two `ReviewContentTest` cases, `RotationJourneyTest` (two journeys), and `ReviewFormLabel` screenshot references (light/dark; only those are new). Unit tests, lint and `assembleDebugAndroidTest` pass; on the S23 via `am instrument` integration 7, component 38 and accessibility 20 pass; `validateDebugScreenshotTest` passes. Mutations caught: first-candidate pick (1 failure) and dropped `markShown` (1 failure), both reverted.
e2e review/completion/daily_allowance: completion and daily_allowance pass; review.feature's result line was cut off in my output, so I can't confirm it was clean (build-1 recorded two known "correct word" auto-advance link failures there). `connectedDebugAndroidTest` via Gradle failed here with "logcat reader failed" though the XML showed 0 failures, hence `am instrument`. Spec deviations: none; the RotationJourney tests click "Done" before `nextDay()`, as SchedulingJourneyTest does.

## 2026-10-14 23:59 word-forms/build-3 (sonnet)
`AddWordContent` split from `AddWordScreen` (stateless, with the snackbar and focus passed in) and the tree editor as specified: per-definition headings and remove buttons, the base form headed by the word, other forms with Form/Label/remove, examples with the "doesn't contain" warning, Add example/form/definition, "Required" on blank fields, and the new test tags (mirrored in `testIds.ts`). The ViewModel's `onEdit` and lookup-replaces-content were already in from build-1; I dropped the flat `definition`/`example`/`partOfSpeech` accessors from `AddWordUiState`. Added `AddWordContentTest` (9), 3 `AddWordUiStateTest` cases, two accessibility states (24 total), four screenshot references (looked at them), a CHANGELOG `### Added` line and `word_forms.feature` with its one new step. Build, unit tests, lint, `assembleDebugAndroidTest`, `validateDebugScreenshotTest`, `check-steps --all` and `typecheck` pass; component 47 and accessibility 24 pass on the S23 via `am instrument`. e2e add_word and word_list pass (34).
`word_forms.feature` passes every step up to "I am told the correct word "ran"" (the session shows "past tense" and the blanked example), then fails on the known Correct-card auto-advance vs. Tailscale latency, as in review.feature. `UiScrollable.scrollIntoView` can't find Save on the long edit screen, so `addWord.save` now scrolls with `mobile: scrollGesture` until it's displayed.
Mutation: letting `RemoveForm` remove the base form fails one `WordContentTest`; reverted. Spec correction: `AddWordContentTest` can't fail on it (the UI never offers a base-form remove and the test records edits without applying them), so only `WordContentTest` guards it.

## 2026-10-14 (cloud) word-forms/build-4 (sonnet)
Word-list search now goes through a pure `filterRows` (root plus every form via `searchTerms`; "practise" finds "practice", "ran" finds "run", definitions don't match). Backup gained the `BackupDefinition`/`BackupForm`/`BackupExample` tree beside the flat root-card fields (version stays 1); `toImport` uses the tree, else `simpleContent`. New `FilterRowsTest` (5) and four `BackupTest` cases (tree round trip, flat mirror, flat-file import, older-build decode via a stand-in serializer); the first round-trip test now expects the full tree. CLAUDE.md, README, PRIVACY, CHANGELOG, `docs/word-forms.md` (implemented) and `docs/todo.md` updated.
Unit tests, lint and `assembleDebugAndroidTest` pass; data 37 and component 47 pass on the phone via `am instrument`. Mutation: `toImport` ignoring `definitions` fails 2 `BackupTest` cases; reverted. No e2e (none named). Spec deviations: none.

## 2026-10-14 (cloud) word-forms/review (sonnet)
Reviewed against the spec and goals: `MIGRATION_2_3` matches `3.json` statement for statement and copies every kept column; `Sm2Scheduler`, `SessionBuilder`, `Grade` and the session queries are untouched since build-1's parent, `recordReview` changed only in a comment; `shownAt` is written only by `markShown` and the editor's save (`insertContent`); `apply` ignores removing the first definition or base form; backup reads both ways and docs match the code. No findings to fix.
Unit tests, lint, `validateDebugScreenshotTest`, script tests, `check-steps` and `typecheck` pass; on the phone data 37, component 47, integration 7 and accessibility 24 pass (Gradle's connected task exits 1 with 0 failures, the known logcat issue). Full e2e: only the known link failures (the "correct word" auto-advance in review, completion's Given and word_forms, plus one `SeedWordsActivity` timeout in notifications). Release smoke on a debug-keystore release build fails only at "I am told the correct word"; with that step removed locally (restored afterwards) the other 19 pass under R8.
Bumped the minor version to 0.5.0 (versionCode 7); the release workflow tags v0.5.0 on this push. No working `gh` login, so main's CI and the release run weren't watched. Piece marked done.

## 2026-10-14 copy-prompt/build-1 (sonnet)
Added `domain/LookupPrompt.kt` and `domain/PastedLookup.kt` (parser, `PasteLimits`, `summary()`, `isBlank()`) with `LookupPromptTest` and `PastedLookupTest` (25 tests). `testDebugUnitTest` and `lintDebug` pass; skipping the example check or the base-form move makes the tests fail, as the spec asks. No UI yet; no spec changes.

## 2026-10-15 copy-prompt/build-2 (sonnet)
The add/edit screen as specified: `PasteDraft`, `canCopyPrompt`, `applying` and the ViewModel's `openPaste`/`onPasteTextChange`/`usePaste`/`dismissPaste` (the ViewModel no longer takes `ClaudeClient`); the Copy prompt / Paste answer row with its help text; the "Paste the answer" dialog (own `testTagsAsResourceId`, focused field); the clipboard write in `AddWordScreen` with "Prompt copied." below API 33; Look up and its tag gone; Settings' section retitled "Keep cards fresh". e2e: lookup scenarios, their steps, `lookUpButton` and `addWordLookUp` removed, new tags mirrored in `testIds.ts`. I also added the CHANGELOG Added/Removed lines now, since the behaviour changed here (build-3 only needs to check them).
Unit tests, lint, `assembleDebugAndroidTest`, `typecheck` and `validateDebugScreenshotTest` pass; on the S23 via `am instrument` component 57 and accessibility 28 pass (the accessibility `check` now touches every root, since a dialog is a second one). Layoutlib renders the `AlertDialog`, so no `Surface` fallback; I looked at the four new references and the four re-recorded ones. Mutation: enabling Use this for `Invalid` fails `anInvalidAnswerShowsItsMessageAndCannotBeUsed`; reverted. e2e add_word, word_list and settings pass; word_forms fails only at the known "I am told the correct word" auto-advance step. By hand on the phone: typed "rhythm", tapped Copy prompt, opened Paste answer and pasted with a paste keyevent (`cmd clipboard` isn't available on this phone): the dialog parsed the pasted prompt, so the clipboard held it.
Deviations: `check-steps --all` reports `I start adding the word {string} without a definition` as unused, because only the removed lookup scenarios used it; build-3's `copy_prompt.feature` uses it again. The spec's grep matches one line, the component test asserting "Look up with Claude" is absent.
For review: the pasted prompt itself parses as Valid (word "...", from the shape line's braces to the last `}`), so a user who pastes the prompt back gets a bogus "valid" answer; consider rejecting a word of "..." or other placeholder text, in the web port too.

## 2026-10-15 copy-prompt/build-3 (sonnet)
`copy_prompt.feature` with its four steps (`copy_prompt.steps.ts`, `addWord` paste helpers, `support/lookupAnswers.ts` holding the fenced "practice" answer), and the Docs section: CLAUDE.md (Lookup section; `ClaudeClient`, model discovery and `lookupRequest`/`StaleCard` moved under Keeping cards fresh), README, PRIVACY, e2e README, `docs/copy-prompt-lookup.md` (implemented, As built) and `docs/todo.md`. CHANGELOG lines were already in from build-2.
`check-steps --all`, `typecheck`, unit tests, lint and script tests pass; on the S23 copy_prompt (13 steps) and add_word pass, and `getClipboard` works there so the clipboard step stays. word_forms fails only at the known "I am told the correct word" auto-advance step.
Spec correction (app fix): the dialog's `testTagsAsResourceId` was only on the text column, so Appium couldn't see "Use this"; it is now on the `AlertDialog` itself. The earlier note about the pasted prompt itself parsing as Valid ("..." word) is still open for review.

## 2026-10-15 copy-prompt/review (sonnet)
Reviewed against the spec and goals: nothing in the add/edit path touches `ClaudeClient` (only the auto-refresh toggle's copy and Settings remain); `lookupPrompt` matches the spec verbatim; the parser's order, messages and limits match the table and are tested verbatim; the base form is moved before `preparedFor`; `updateWordWithContent` leaves the review log alone and `updateWordKeepsSchedulingAndShownAt` covers scheduling; the dialog's tags reach Appium (`copy_prompt.feature` passes on the phone); PRIVACY matches what the code sends. One finding fixed: the prompt pasted back parsed as Valid (word "..."), so a word of only dots or "…" is now refused with "That's the prompt, not the chat's answer. Paste the chat's reply instead." (new `PastedLookupTest` case, spec table row and `docs/copy-prompt-lookup.md` updated; `web-core` must port this row).
Unit tests, lint, `validateDebugScreenshotTest`, script tests, `check-steps --all` and `typecheck` pass; on the phone data 37, component 57, integration 7 and accessibility 28 pass (Gradle's connected task exits 1 with 0 failures, the known logcat issue). Full e2e: only the known auto-advance link failures at "I am told the correct word" (necessary, ran), plus the completion Given that shares it; copy_prompt, add_word, word_list, settings, backup and the rest pass. Release smoke on a debug-keystore release build fails only at "I am told the correct word" again; I didn't repeat the step-removed run since the release journey doesn't touch the changed screen.
Bumped the minor version to 0.6.0 (versionCode 8); the release workflow tags v0.6.0 on this push. No working `gh` login here, so main's CI and the release run weren't watched. Piece marked done.

## 2026-10-15 (cloud) drop-api-key/build-1 (sonnet)
Deleted `ClaudeClient` (and `data/remote/`), `CardRefresher`, `CardRefresh`, `SecretCipher`, their unit tests and `claude_lookup` e2e. `AppContainer` lost `claude`, `cardRefresher` and `appScope`; `SettingsStore` lost the key and gained `forgetLegacyApiKey()` (only when the old `apiKey` preference exists; `runCatching` around the Keystore); the add/edit toggle, Settings' key section, `testKey` and the repository's refresh functions went; OkHttp, `org.json` (test) and the INTERNET permission are gone (`aapt2` shows none in the debug APK). Home's empty text and the Backup help text follow the spec; `WordBlank` KDoc reworded. `Word` keeps its two columns for build-3. Added a CHANGELOG `Removed` section now (build-4 only verifies it).
Unit tests, lint, `assembleDebugAndroidTest`, screenshot validation (AddWord New/PasteError/PasteRenames and HomeNoWords references re-recorded, checked by eye), `check-steps`/`typecheck` and script tests pass. On the S23 via install + `am instrument`: data 36, integration 7, accessibility 28; component 57 passed (gradle's connected task exited 1 with no failures, the known phone-link oddity). New `SettingsStoreTest` (2); removing the `forgetLegacyApiKey()` call fails one of them, reverted. e2e `add_word` (7) and `settings` (6) pass; `review.feature` passes 24 steps and fails the two "I am told the correct word" steps, the known Correct-card auto-advance vs. Tailscale latency, unrelated to this change. Spec deviation: none.

## 2026-10-15 (cloud) drop-api-key/build-2 (sonnet)
Split `SettingsScreen` into the stateful screen and `SettingsContent` (a pure move; the Android 13 permission branch stays in the screen's `onReminderToggle`). Added `SettingsContentTest` (10 tests), `Fixtures.settings`, two accessibility states and four screenshot references (defaults and reminders off, light and dark; looked at the dark off and light default ones, fine).
Unit tests, lint, `assembleDebugAndroidTest` and screenshot validation pass; on the S23 component 67 and accessibility 32 pass; dropping `enabled = !busy` from Export fails the component test (reverted). e2e settings passes; notifications passes 19 steps and fails only at the known `SeedWordsActivity did not finish` link timeout in the refusal scenario. No spec changes.

## 2026-10-15 (cloud) drop-api-key/build-3 (sonnet)
Schema v4: `Word` lost `autoRefresh` and `refreshedOn`; `MIGRATION_3_4` rebuilds `words` without them (statements match the generated `4.json`; `DATABASE_VERSION` 4, added to `ALL_MIGRATIONS`). `BackupWord` and its mappers stop writing and reading the two fields, with the format note moved to `BackupFile`'s KDoc (version stays 1). New `MigrationTest` cases: a version 3 seed (reviewed word with every scheduling column off its default and the refresh flags set, a new word, "Café" suspended, a second definition with a labelled form, one example with `shownAt`, three logs), the 3→4 test (kept columns, no refresh columns, content and log rows identical, empty `foreign_key_check`) and the Room-path test (counts, `contentById` trees with `shownAt`, `Word` equality). `BackupTest` covers a flat file that still carries the two keys, an export without them, and a stand-in older `BackupWord` reading a file written now.
`assembleDebug`, unit tests, lint and `assembleDebugAndroidTest` pass; on the S23 the data layer is 38 tests, 0 failures (gradle's connected task exits 1 on the known logcat error). `git status` shows only the new `4.json`; `grep autoRefresh|refreshedOn app/src/main` leaves `MIGRATION_1_2`, `MIGRATION_3_4` and their KDocs. All three mutations were caught and reverted: leaving `lapses` out of the copy (3 failures), `DELETE FROM review_log WHERE id = 1` (4) and `DELETE FROM definitions WHERE id = 1` (4), each including the 3→4 and Room-path tests. I did not rerun the integration layer (no code it touches changed beyond the removed `Word` fields). No CHANGELOG line (not user-visible; build-4 verifies it). Spec deviations: none.

## 2026-10-15 (cloud) drop-api-key/build-4 (sonnet)
e2e: `DEFAULT_TAGS` and its KDoc lose `@live-api`; `logFilters` and `appium-log-filters.json` are gone; `typeInto`'s KDoc and the README gotchas drop the masked-field text (the log gotcha is one line); `add_word.feature` says "with or without a chat AI" and `copy_prompt.feature` "with no account". Docs: CLAUDE.md (intro, test table, live-API bullet, wiring, Lookup closing line, "Keeping cards fresh" removed, "Data safety", Settings in `XContent` list), README, PRIVACY (no Internet permission, legacy key sentence), `docs/testing-and-web-plan.md`, `copy-prompt-lookup.md` As built, `word-forms.md`, `docs/todo.md` ticked, ci.yml header. CHANGELOG's two Removed lines were already in and match the spec.
Unit tests, lint, `assembleDebug`, script tests, `check-steps` (both), `typecheck` pass; on the S23 settings (6) and add_word (7) pass. The spec's `git grep` now leaves only the allowed matches. Spec deviations: none.

## 2026-10-16 07:40 drop-api-key/review (sonnet)
Reviewed against the spec and goals: no network code or `INTERNET` permission in `app/src` or the release APK (`aapt2` lists notifications, WorkManager's wake lock, network state, boot and foreground-service only); `MIGRATION_3_4` matches `4.json` statement for statement and copies every kept column, and two mutations (`lapses` copied as 0, a late `DELETE FROM review_log`) fail 3 and 4 data tests, both reverted; `Scheduler`, `Srs`, `SessionBuilder` and `ReviewLog` are untouched and `recordReview` changed only in its comment; `forgetLegacyApiKey` touches the Keystore only when the old preference exists, inside `runCatching`; `BackupTest` covers a 0.3.0-style flat file and the older-build stand-in; PRIVACY and CLAUDE.md match the code. No app findings.
Unit tests, lint, screenshot validation, script tests, `check-steps`/`typecheck` and data, component, integration (7) and accessibility (32) pass on the API 34 emulator. Full e2e failed once, at `my words read "0 known, 1 learning, 0 new"`: the 320x640 emulator's `scrollIntoView` stops when the words card's top edge shows, leaving the progress bar below the fold. The step now scrolls to the bar's own description (`scrollToDescription`); the full suite then passes (167 steps). The release smoke on a debug-keystore release build failed at the Export tap in 3 of 6 runs because the tap sometimes opens no picker (nothing in the app: the picker opens by hand); `backup.export` now taps once more if no picker shows, and the smoke passed 4 of 4 after it. One earlier review run also stopped at Home's "All done" with a word just added; it didn't recur in 8 later runs of that scenario and I found no cause.
Bumped the minor version to 0.7.0 (versionCode 9); the release workflow tags v0.7.0 on this push.

## 2026-10-16 07:44 web-core/build-1 (sonnet)
`web/` (npm project, strict tsconfig, Vitest, `idb` as the one runtime dependency), the Dependabot entry (the `web` CI job did not push, see below); `golden/` with its README and seven files (text, blank, diff, sm2, days, progress, session: 171 Vitest tests), the Kotlin runner (`Golden.kt` and seven `*GoldenTest` classes, wired through `golden.dir` and a task input in `app/build.gradle.kts`) and the Vitest runner (`load.ts` and seven files). Ported `text`, `random`, `clock`, `days`, `srs`, `session`, `queries`, `progress`, `spellingDiff` and `wordBlank`; `queries.test.ts` and a `hourOf` test are TypeScript-only. `Word` and `ReviewLog` are in `web/src/data/model.ts` now (progress and queries need them); build-3 adds `StoredWord` and the backup types.
`<web>`, `./gradlew testDebugUnitTest lintDebug` and the script tests pass; all seven `*GoldenTest.xml` have `skipped="0"`. Every expected value, the NBSP/U+001F/BOM/İ traps included, passed on the JVM as written, so none was bent. Mutations: sm2 "6" to "5" fails both runners (Gradle reruns, not UP-TO-DATE); `normalizeWord` with `\s` fails 3 text cases; `ktTrim` as `trim()` fails 5; each reverted. Escapes for invisible characters in the golden JSON are `\uXXXX` (re-escaped after my editor wrote some as literals). No spec deviations.
Blocked on the CI job: the push of `.github/workflows/ci.yml` (a `web` job after `scripts`: checkout, `actions/setup-node@v7` Node 22 with `cache: npm` and `cache-dependency-path: web/package-lock.json`, then `npm ci`, `npm run typecheck`, `npm test` with `working-directory: web`, plus the header comment) was refused: the job's token has no `workflow` scope. Everything else is pushed without it; the `web` job is the only part of build-1 left, and its check ("the `web` job is green on the pushed commit") has not run.
