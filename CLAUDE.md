# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Tortoise Spelling is a single-module native Android app (Kotlin, Jetpack Compose, min SDK 26,
target 36) for learning to spell your own word list with SM-2 spaced repetition, a daily
reminder, and word lookup by copying a prompt into any chat AI and pasting its answer back.
User-facing overview: `README.md`.

## Commands

Requirements: Android Studio (or the Android SDK + JDK 17), an emulator or device on
Android 8.0 (API 26) or newer.

Gradle needs `JAVA_HOME`; on this machine use Android Studio's JBR
(`C:\Program Files\Android\Android Studio\jbr`). Use `gradlew.bat` from PowerShell and
`./gradlew` from Git Bash.

```bash
./gradlew assembleDebug                       # debug APK -> app/build/outputs/apk/debug/
./gradlew testDebugUnitTest                   # JVM unit tests (no device)
./gradlew testDebugUnitTest --tests '*SrsTest'                  # one class
./gradlew testDebugUnitTest --tests '*DaysTest.a quiet*'        # one method (backtick names)
./gradlew lintDebug                           # CI fails on lint errors, not warnings
./gradlew connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.package=io.github.dontpanic345.tortoisespelling.data
                                              # data layer tests, on the emulator (set ANDROID_SERIAL)
./gradlew connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.package=io.github.dontpanic345.tortoisespelling.component
                                              # component tests: each screen's content alone, same device rules
./gradlew connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.package=io.github.dontpanic345.tortoisespelling.integration
                                              # integration tests: real navigation + repository, in-memory DB, test clock
./gradlew connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.package=io.github.dontpanic345.tortoisespelling.accessibility
                                              # accessibility checks: each screen state, light and dark, through Compose's ATF integration
./gradlew updateDebugScreenshotTest         # re-record screenshot references (app/src/screenshotTestDebug/reference/); commit them
./gradlew validateDebugScreenshotTest       # compare screenshots to the references, JVM, no device
./gradlew assembleDebugAndroidTest            # compile the instrumented tests, no device
node --test 'scripts/*.test.mjs'              # script tests (quote the glob)
node scripts/icon.mjs                         # regenerate the app and notification icons
adb install -r app/build/outputs/apk/debug/app-debug.apk       # install the debug APK
```

| Layer | Where | Runs on |
|---|---|---|
| Unit tests | `app/src/test/` | JVM, no device |
| Data tests | `app/src/androidTest/.../data/` | Emulator, real SQLite |
| Component tests | `app/src/androidTest/.../component/` | Emulator, one screen's `XContent` with fake state |
| Integration tests | `app/src/androidTest/.../integration/` | Emulator, the real nav graph over an in-memory DB and a `TestClock` |
| Accessibility tests | `app/src/androidTest/.../accessibility/` | Emulator, the same `XContent` states as the component tests (`component/Fixtures.kt`), both themes |
| Screenshot tests | `app/src/screenshotTest/` | JVM (Layoutlib), no device; references committed; CI's `screenshots` job validates them. After a deliberate UI change, run `update`, look at the images and commit them |
| End-to-end BDD tests | [`e2e/`](e2e/README.md) | The real APK on an emulator |
| Script tests | `scripts/*.test.mjs` | Node, no device |

Each instrumented layer has its own package under `androidTest`, selected with the runner's
`package` argument.

- **CI** (`.github/workflows/ci.yml`) runs the unit tests, `lintDebug`, the script tests and
  the e2e `check-steps`/`typecheck` on pushes to main and on PRs. It also validates the
  screenshots and runs the data, component, integration and accessibility layers, one
  `instrumented` matrix job each (API 26 emulators; API 34 for accessibility). It doesn't
  run the Appium scenarios; their release smoke runs from `release.yml`.

- **Connected tests** run on every attached device and uninstall the app afterwards, which
  deletes its data. Set `ANDROID_SERIAL` to the emulator, and never run them on a phone
  with real data.

- **Release build.** Unsigned unless `RELEASE_KEYSTORE_PATH`, `RELEASE_KEYSTORE_PASSWORD`,
  `RELEASE_KEY_ALIAS` and `RELEASE_KEY_PASSWORD` are set. For a local installable release,
  point them at the debug keystore (`~/.android/debug.keystore`, password and key password
  `android`, alias `androiddebugkey`).
- **R8 is on for release.** Anything that works in debug but reflects on classes must be
  re-checked on a release build on a device. Lint-vital runs as part of `assembleRelease`.
  `npm run e2e:release` (from `e2e/`, with `APK` set to the release APK) runs the one
  `@release-smoke` journey; `release-smoke.yml` runs it on CI and `release.yml` waits for it.
- **E2E tests** live in `e2e/`, with their own npm project. From `e2e/`:
  - `npm run e2e`: needs a running emulator and a built debug APK.
  - `npm run e2e -- --spec features/<name>.feature`: one feature file.
  - `npm run check-steps -- --all`: device-free check that every step is defined and used,
    in about a second.
  - `npm run typecheck`

  Keep the suite minimal (testing pyramid): journeys and device-only behaviour; logic goes
  in unit tests. Given steps seed words through the debug-only `SeedWordsActivity`
  (`app/src/debug`). See `e2e/README.md` for the setup and the Appium gotchas.

## Architecture

**Wiring.** There's no DI framework. `TortoiseSpellingApp` builds an `AppContainer` (the Room
database, `SettingsStore`, `WordRepository`, and the clock and fuzz the tests set). Composables reach it via
`rememberAppContainer()` (tests supply one through `LocalAppContainer`), and each ViewModel
has a companion `factory(container, ...)`.
Navigation is string routes in `ui/Nav.kt`, and the `NavHost` is in `MainActivity.kt`.

**Layers.**
- `data/`: Room entities `Word`, `Definition`, `WordForm`, `ExampleSentence` and `ReviewLog`
  (`WordWithContent` loads a word's tree), the DAO, `WordRepository`, `SettingsStore`, and
  backup (de)serialization.
- `domain/`: pure Kotlin, no Android, and where the unit tests concentrate. Covers
  scheduling, session building, streaks, spelling diffs, word blanking, the content model
  (`WordContent`), card picking (`CardPick.kt`), and the lookup prompt and paste parsing.
- `ui/<screen>/`: one Screen + ViewModel pair per screen, holding a `MutableStateFlow` of UI state.
  Screens with component tests (Review, Home, word list, Settings) split into a stateful `XScreen` and an
  `XContent` that takes state and callbacks and touches no ViewModel.
- `notify/`: the reminder scheduler and worker.

**Dates are epoch days, not millis.** `dueOn`, `firstReviewedOn` and `reviewedOn` are
`LocalDate.toEpochDay()` values, via `domain/Days.kt`; days roll over at local midnight.
Timestamps named `...At` (including an example's `shownAt`) are millis.
"Today" and "now" come from the `java.time.Clock` on `AppContainer` (`Days.today(clock)`,
`DeviceClock` in production), and the repository's due-day fuzz is a constructor
parameter, so tests can set the date and know the exact day a word returns. The reminder
(`notify/`) and backup timestamps deliberately read the real time.

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
- Each word becomes a `ReviewCard` through `pickCard`: the least recently shown example
  across all its forms, random among ties, and the review asks for that form's spelling.
  `shownAt` is stamped when a card is first shown, in practice mode too.
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

**Lookup** (`domain/LookupPrompt.kt`, `domain/PastedLookup.kt`).
- Copy prompt puts `lookupPrompt(word)` on the clipboard; the user takes it to any chat AI
  and pastes the reply into the "Paste the answer" dialog.
- `parsePastedLookup` validates the reply: it locates the JSON between the outer braces
  (so a code fence or prose around it is fine), reports exact messages, and enforces the
  limits in `PasteLimits`. Use this replaces the editor's word and content; saving keeps
  the word's scheduling.
- The prompt asks for an example sentence that contains the exact word form so the review
  screen can blank it out, and the parser checks that.
- Nothing in the app calls an AI API, and the manifest has no Internet permission.

**Data safety.**
- No setting is a secret. `SettingsStore` deletes the encrypted API key and Keystore entry an
  earlier version left.
- Room has **no** `fallbackToDestructiveMigration`. Schemas are exported to `app/schemas/`,
  so any entity change needs a version bump and a real `Migration`. Version 2 added
  `autoRefresh` and `refreshedOn` to `words`, and version 4 dropped them with the same
  rebuild as version 3. Version 3 moved `definition`, `example` and `partOfSpeech` into `definitions`, `word_forms` and `example_sentences`, rebuilding
  `words` (the pattern a column drop copies). A schema change also appends its `Migration`
  to `ALL_MIGRATIONS`, bumps `DATABASE_VERSION`, and adds a test to `MigrationTest` that
  seeds the previous version and checks every column comes through.
- Backups are versioned JSON (`data/Backup.kt`); import merges and never overwrites
  existing words' progress. Each word carries a `definitions` tree beside flat
  `definition`, `example` and `partOfSpeech` fields from its root card, so older builds
  still read the file and the format version stays 1; a file with no tree imports as
  one definition, one form and one example. Files from versions that had `autoRefresh` and
  `refreshedOn` still import; the keys are ignored.
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
- The blank and the answer are the asked form's, and `hideWordInDefinition` scrubs every
  form of the word from every definition when a word is saved.
- Word-list search matches the root and every form's spelling (`searchTerms`), never definitions.

**Icons.** `ic_launcher_foreground.xml`, `ic_launcher_monochrome.xml`, `ic_notification.xml`,
`ic_launcher_background.xml` and `docs/icon.svg` are generated. Edit `scripts/icon.mjs` and
re-run it; `icon.test.mjs` fails CI if the committed files drift from the script.

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
`ci.yml` and `release-smoke.yml`, builds a signed, R8-minified APK from four repo secrets,
and publishes it to GitHub Releases, creating the tag only then; don't push tags by hand. There is no Play
Store listing. A failed release is re-run from the Actions tab (it runs on main only).

- **Changelog.** `CHANGELOG.md` follows Keep a Changelog. Any user-visible change adds a
  line under `[Unreleased]` in the same commit. The GitHub release notes are the version's
  section, not generated notes.
- **Version bump.** `node scripts/bump-version.mjs <major|minor|patch|X.Y.Z>` raises
  `versionName` and `versionCode` and moves `[Unreleased]` under a dated heading. It
  doesn't commit or tag. Bumping a minor or patch version is allowed without asking, and
  that includes Jogging sessions; a major bump needs the owner's say-so.
- **Release gate.** `scripts/check-release.mjs` fails the release unless `versionCode`
  beats the previous tag's and the changelog has notes; `--tag` prints `v<versionName>`. The
  logic is in `scripts/version.mjs`, which is pure and covered by `version.test.mjs`.
