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
