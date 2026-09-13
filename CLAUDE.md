# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

TortoiseSpelling is a single-module native Android app (Kotlin, Jetpack Compose, min SDK 26,
target 36) for learning to spell your own word list with SM-2 spaced repetition, a daily
reminder, and optional word lookup through the Anthropic API. User-facing overview: `README.md`.

## Commands

Gradle needs `JAVA_HOME`; on this machine use Android Studio's JBR
(`C:\Program Files\Android\Android Studio\jbr`). Use `gradlew.bat` from PowerShell and
`./gradlew` from Git Bash.

```bash
./gradlew assembleDebug                       # debug APK -> app/build/outputs/apk/debug/
./gradlew testDebugUnitTest                   # JVM unit tests (no device)
./gradlew testDebugUnitTest --tests '*SrsTest'                  # one class
./gradlew testDebugUnitTest --tests '*DaysTest.a quiet*'        # one method (backtick names)
./gradlew lintDebug                           # CI fails on lint errors, not warnings
node --test 'scripts/*.test.mjs'              # release script tests (quote the glob)
```

- **CI** (`.github/workflows/ci.yml`) runs the unit tests, `lintDebug`, the script tests and
  the e2e `check-steps`/`typecheck` on pushes to main and on PRs. It doesn't run the Appium
  scenarios.

- **Live API tests.** `ClaudeIntegrationTest` is skipped unless `TORTOISESPELLING_ANTHROPIC_KEY`
  is set. Gradle doesn't treat env vars as task inputs, so add `--rerun`; otherwise the task
  can be UP-TO-DATE and the 6 tests silently stay skipped.
- **Release build.** Unsigned unless `RELEASE_KEYSTORE_PATH`, `RELEASE_KEYSTORE_PASSWORD`,
  `RELEASE_KEY_ALIAS` and `RELEASE_KEY_PASSWORD` are set. For a local installable release,
  point them at the debug keystore (`~/.android/debug.keystore`, password and key password
  `android`, alias `androiddebugkey`).
- **R8 is on for release.** Anything that works in debug but reflects on classes must be
  re-checked on a release build on a device. Lint-vital runs as part of `assembleRelease`.
- **E2E tests** live in `e2e/`, with their own npm project. From `e2e/`:
  - `npm run e2e`: needs a running emulator and a built debug APK.
  - `npm run e2e -- --spec features/<name>.feature`: one feature file.
  - `npm run check-steps`: device-free check that every step is defined, in about a second.
  - `npm run typecheck`

  See `e2e/README.md` for the setup and the Appium gotchas.

## Architecture

**Wiring.** There's no DI framework. `TortoiseSpellingApp` builds an `AppContainer` (the Room
database, `SettingsStore`, `ClaudeClient`, `WordRepository`). Composables reach it via
`rememberAppContainer()`, and each ViewModel has a companion `factory(container, ...)`.
Navigation is string routes in `ui/Nav.kt`, and the `NavHost` is in `MainActivity.kt`.

**Layers.**
- `data/`: Room entities `Word` and `ReviewLog`, the DAO, `WordRepository`, `SettingsStore`,
  and backup (de)serialization.
- `domain/`: pure Kotlin, no Android, and where the unit tests concentrate. Covers
  scheduling, session building, streaks, spelling diffs and word blanking.
- `ui/<screen>/`: one Screen + ViewModel pair per screen, holding a `MutableStateFlow` of UI state.
- `notify/`: the reminder scheduler and worker.

**Dates are epoch days, not millis.** `dueOn`, `firstReviewedOn` and `reviewedOn` are
`LocalDate.toEpochDay()` values, via `domain/Days.kt`; days roll over at local midnight.
Timestamps named `...At` are millis.

**Scheduling.**
- `WordRepository.recordReview` applies `Sm2Scheduler`, which sits behind the `Scheduler`
  interface so FSRS can replace it later.
- Grading is implicit: correct first try is quality 5, correct only after the mandatory
  retype is 2 (`data/ReviewLog.kt` `Grade`).
- Quality 2 is deliberately below SM-2's reset threshold of 3: a word the user couldn't
  produce comes back tomorrow.
- A review is recorded at the first attempt, so abandoning mid-correction still counts as
  a lapse.
- Intervals cap at 365 days, and anything over 2 days is fuzzed.

**Today's session.**
- A session is every due word plus the new-word allowance, interleaved (`SessionBuilder.kt`).
- The allowance counts words *introduced* today (`firstReviewedOn == today`), not reviews
  done today, so a heavy review day can't starve new words.
- Practice mode (`randomWords`) never writes scheduling state or logs.

**Streak.** It combines the days in `review_log` with "satisfied" days stored in
`SettingsStore`: days on which nothing was due. Home and the reminder worker both record
satisfied days, and they bridge a streak rather than breaking it.

**Daily reminder** (`notify/`). This is the feature the app exists for, so be careful here.
- It's a self-rescheduling `OneTimeWorkRequest` aimed at an absolute clock time; it is not
  periodic work, and it uses no exact alarms.
- App start calls `ReminderScheduler.ensureScheduled` (`ExistingWorkPolicy.KEEP`).
  WorkManager cold-starts the process to run the reminder, so a `REPLACE` in
  `Application.onCreate` would cancel the very run that is about to happen.
- `REPLACE` (`sync`/`schedule`) is only for Settings changes and for the worker booking its
  own next run.
- Reminders default to on. On Android 13+ the notification permission is requested from
  Home once the user has a word (`ui/NotificationPermission.kt`). A refusal turns reminders
  off, and the Settings switch shows the *effective* state: enabled AND permission granted.

**Notification deep link.** The reminder opens `MainActivity` with the `startReview` extra.
It's honoured only on a fresh launch: not when `savedInstanceState` is non-null, and not
when the activity was launched from Recents. Otherwise a rotation or process restore
re-opens Review.

**Claude lookup** (`data/remote/ClaudeClient.kt`).
- Raw OkHttp to the Messages API, on purpose; no Anthropic SDK.
- The model isn't configurable. It's discovered at runtime from `GET /v1/models` (the
  newest model whose id contains "haiku"), with `LookupModel.FALLBACK` as the fallback, and
  a 404 clears the cached choice.
- The prompt asks for JSON with a corrected spelling, and an example sentence that
  contains the exact word form so the review screen can blank it out. `parseLookup` is
  lenient: prose around the JSON is tolerated, and unparseable output is handed to the
  user to edit.

**Secrets and data safety.**
- The API key is the only encrypted setting: AES-GCM with an Android Keystore key
  (`SecretCipher`), no security-crypto library. If the key can't be decrypted (e.g. after
  a device restore), it's treated as absent.
- Room has **no** `fallbackToDestructiveMigration`. Schemas are exported to `app/schemas/`,
  so any entity change needs a version bump and a real `Migration`.
- Backups are versioned JSON (`data/Backup.kt`); import merges and never overwrites
  existing words' progress.

**Review screen details that look wrong but aren't.**
- The answer field uses `KeyboardType.Password` so Gboard and Samsung Keyboard can't
  autocorrect or suggest the answer; the text isn't masked, because there's no
  `VisualTransformation`.
- The blank placeholder is a fixed `_____` regardless of word length.
- `hideWordInDefinition` scrubs the word out of definitions when a word is saved.

**Test tags.** `ui/TestTags.kt` holds Compose `testTag`s for the e2e suite.
`MainActivity` sets `testTagsAsResourceId`, so Appium sees each tag as a resource-id.
Mirror every tag in `e2e/support/testIds.ts`. Dialogs and popups are separate windows and
need their own `testTagsAsResourceId`.

## Release

Pushing a `v*` tag runs `.github/workflows/release.yml`. It builds a signed, R8-minified
APK from four repo secrets and publishes it to GitHub Releases, to be sideloaded; there is
no Play Store listing. The workflow deliberately has no manual trigger: the release is
named after `github.ref_name`, so a manual run from a branch would create a tag called `main`.

- **Changelog.** `CHANGELOG.md` follows Keep a Changelog. Any user-visible change adds a
  line under `[Unreleased]` in the same PR. The GitHub release notes are the version's
  section, not generated notes.
- **Version bump.** `node scripts/bump-version.mjs <major|minor|patch|X.Y.Z>` raises
  `versionName` and `versionCode` and moves `[Unreleased]` under a dated heading. It
  doesn't commit or tag, because the tag belongs on main after the bump is merged.
- **Release gate.** `scripts/check-release.mjs` fails the release unless the tag is
  `v<versionName>`, `versionCode` beats the previous tag's, and the changelog has notes. The
  workflow also requires the tag to be on main and calls `ci.yml` before building. The
  logic is in `scripts/version.mjs`, which is pure and covered by `version.test.mjs`.
