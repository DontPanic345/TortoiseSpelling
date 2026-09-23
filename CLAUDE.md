# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Tortoise Spelling is a single-module native Android app (Kotlin, Jetpack Compose, min SDK 26,
target 36) for learning to spell your own word list with SM-2 spaced repetition, a daily
reminder, and optional word lookup through the Anthropic API. User-facing overview: `README.md`.

## Commands

Requirements: Android Studio (or the Android SDK + JDK 17), an emulator or device on
Android 8.0 (API 26) or newer. Gradle needs `JAVA_HOME`; on this machine use Android
Studio's JBR (`C:\Program Files\Android\Android Studio\jbr`). Use `gradlew.bat` from
PowerShell and `./gradlew` from Git Bash. Open the project in Android Studio and press
Run, or use the commands below from a terminal.

```bash
./gradlew assembleDebug                       # debug APK -> app/build/outputs/apk/debug/
adb install -r app/build/outputs/apk/debug/app-debug.apk       # install the debug APK
./gradlew testDebugUnitTest                   # JVM unit tests (no device)
./gradlew testDebugUnitTest --tests '*SrsTest'                  # one class
./gradlew testDebugUnitTest --tests '*DaysTest.a quiet*'        # one method (backtick names)
./gradlew lintDebug                           # CI fails on lint errors, not warnings
node --test 'scripts/*.test.mjs'              # release script tests (quote the glob)
```

| Layer | Where | Runs on |
|---|---|---|
| Unit tests | `app/src/test/` | JVM, no device |
| Live-API integration test | `ClaudeIntegrationTest` | JVM, real Anthropic API |
| End-to-end BDD tests | [`e2e/`](e2e/README.md) | The real APK on an emulator |
| Release script tests | `scripts/*.test.mjs` | Node, no device |

- **CI** (`.github/workflows/ci.yml`) runs the unit tests, `lintDebug`, the script tests and
  the e2e `check-steps`/`typecheck` on pushes to main and on PRs. It doesn't run the Appium
  scenarios.

- **Live API tests.** `ClaudeIntegrationTest` exercises the real lookup flow and is skipped
  unless `TORTOISESPELLING_ANTHROPIC_KEY` is set. Gradle doesn't treat env vars as task
  inputs, so add `--rerun`; otherwise the task can be UP-TO-DATE and the 7 tests silently
  stay skipped.

  ```bash
  TORTOISESPELLING_ANTHROPIC_KEY=sk-ant-... ./gradlew testDebugUnitTest --tests '*ClaudeIntegrationTest' --rerun
  ```

- **Release build.** Unsigned unless `RELEASE_KEYSTORE_PATH`, `RELEASE_KEYSTORE_PASSWORD`,
  `RELEASE_KEY_ALIAS` and `RELEASE_KEY_PASSWORD` are set. For a local installable release,
  point them at the debug keystore (`~/.android/debug.keystore`, password and key password
  `android`, alias `androiddebugkey`).
- **R8 is on for release.** Anything that works in debug but reflects on classes must be
  re-checked on a release build on a device. Lint-vital runs as part of `assembleRelease`.
- **E2E tests.** Gherkin scenarios ("When I add the word … Then Home shows 1 word to
  practice today") run against the installed app with Appium, WebdriverIO and Cucumber.
  They live in `e2e/`, with their own npm project. From `e2e/`:
  - `npm install && npm run e2e`: needs a running emulator and a built debug APK.
  - `npm run e2e -- --spec features/<name>.feature`: one feature file.
  - `npm run check-steps -- --all`: device-free check that every step is defined and used,
    in about a second.
  - `npm run typecheck`

  Keep the suite minimal (testing pyramid): journeys and device-only behaviour; logic goes
  in unit tests. Given steps seed words through the debug-only `SeedWordsActivity`
  (`app/src/debug`). See `e2e/README.md` for the setup and the Appium gotchas.

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
- `lookupRequest` builds the user turn and is pure, so it is unit-tested. A refresh
  passes a `StaleCard`, which sends the card being replaced back to the model; without
  it, "write something different" has nothing to be different from and the same stock
  sentence comes back.

**Keeping cards fresh** (`data/CardRefresher.kt`). A word's `autoRefresh` flag, set from
the add/edit screen, has Claude rewrite its definition and example.
- The trigger is a review session starting; `domain/CardRefresh.kt` decides which words
  are due, capped at one rewrite per word per day. Practice mode never triggers it.
- The rewrite is deliberately *not* raced against the session that started it. It lands
  while the user reviews the old card and shows up next time the word comes round —
  blocking session start on a dozen API calls would be worse than one more stale
  sentence.
- It runs on an application-scoped coroutine in `AppContainer`, not `viewModelScope`, so
  quitting the session doesn't cancel it. It is not WorkManager: if the process dies the
  rest of the words keep their old cards and the next session picks them up.
- `refreshedOn` is stamped *before* the call, so a rejected key isn't retried all day.
- The write is a targeted `updateContent` query, and `recordReview` re-reads the row
  before writing. Both are needed: the refresh runs while the user is reviewing, and a
  whole-row `@Update` from the session's opening snapshot would otherwise roll back
  whichever of the two wrote first.

**Secrets and data safety.**
- The API key is the only encrypted setting: AES-GCM with an Android Keystore key
  (`SecretCipher`), no security-crypto library. If the key can't be decrypted (e.g. after
  a device restore), it's treated as absent.
- Room has **no** `fallbackToDestructiveMigration`. Schemas are exported to `app/schemas/`,
  so any entity change needs a version bump and a real `Migration`. Version 2 added
  `autoRefresh` and `refreshedOn` to `words`.
- Backups are versioned JSON (`data/Backup.kt`); import merges and never overwrites
  existing words' progress.
- Android Auto Backup is gated behind `Settings.cloudBackupEnabled` (off by default) via
  `TortoiseSpellingBackupAgent` (`android:backupAgent`, `android:fullBackupOnly="true"`),
  which calls `super.onFullBackup` only when the switch is on, or the pass is a
  device-to-device transfer (`FullBackupDataOutput.transportFlags`, API 28+; mirrored as a
  pure function in `domain/BackupPolicy.kt`) — a D2D transfer never touches Google's
  servers, so it runs regardless of the switch. During a backup pass Android runs the
  process in restricted mode and never creates `TortoiseSpellingApp`, so the agent reads
  the switch straight out of `SettingsStore`'s SharedPreferences file rather than through
  `AppContainer`.

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

## Workflow

There are no pull requests, no branches and no branch protection; work directly on main.

- Once a change is verified (unit tests and lint, plus the e2e suite if it touches the
  app or `e2e/`), commit it to main and push. Push as you go instead of batching up
  local commits.
- Dependabot still opens PRs against main. Merge or close them from the GitHub side;
  Dependabot closes its own PRs once main has the new versions. An update that can't be
  taken gets an `ignore` entry in `.github/dependabot.yml`, with the reason in a comment.

## Release

Merging a version bump to main releases it. `.github/workflows/release.yml` runs on every
push to main and does nothing if `v<versionName>` is already tagged. Otherwise it runs
`ci.yml`, builds a signed, R8-minified APK from four repo secrets, and publishes it to
GitHub Releases, creating the tag only then; don't push tags by hand. There is no Play
Store listing. A failed release is re-run from the Actions tab (it runs on main only).

- **Changelog.** `CHANGELOG.md` follows Keep a Changelog. Any user-visible change adds a
  line under `[Unreleased]` in the same commit. The GitHub release notes are the version's
  section, not generated notes.
- **Version bump.** `node scripts/bump-version.mjs <major|minor|patch|X.Y.Z>` raises
  `versionName` and `versionCode` and moves `[Unreleased]` under a dated heading. It
  doesn't commit or tag.
- **Release gate.** `scripts/check-release.mjs` fails the release unless `versionCode`
  beats the previous tag's and the changelog has notes; `--tag` prints `v<versionName>`. The
  logic is in `scripts/version.mjs`, which is pure and covered by `version.test.mjs`.
