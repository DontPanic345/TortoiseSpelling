# CLAUDE.md

Tortoise Spelling: learn to spell your own word list with SM-2 spaced repetition and a
daily reminder. Two apps share one word logic and one backup file:

- **Android** (`app/`): Kotlin, Jetpack Compose, min SDK 26. The primary app.
- **Web** (`web/`): a TypeScript port with Preact screens, on GitHub Pages. Its rules:
  [`web/README.md`](web/README.md). Its reminder server is `push/` ([`push/README.md`](push/README.md)).

[`golden/`](golden/README.md) holds cases both apps run; [`specs/`](specs/README.md) holds
Gherkin features both apps run, Android through [`e2e/`](e2e/README.md), web through
`web/steps/`. User-facing overview: `README.md`.

## Where you are running

- **A Jogging session** (GitHub Actions, Ubuntu): your prompt governs and describes the
  runner. Do only your step; use `./gradlew`. How Jogging works: [`jogging/README.md`](jogging/README.md).
- **Alan's PC, Windows**: Gradle needs `JAVA_HOME` set to Android Studio's JBR
  (`C:\Program Files\Android\Android Studio\jbr`); `gradlew.bat` in PowerShell, `./gradlew`
  in Git Bash.
- **Alan's PC, WSL**: no JDK or Android SDK. Web, push, scripts and docs work here; Android
  builds and tests run on Windows.

## Checks

```bash
./gradlew testDebugUnitTest                   # JVM unit tests + golden cases; --tests '*SrsTest' for one class
./gradlew lintDebug                           # CI fails on lint errors, not warnings
./gradlew validateDebugScreenshotTest         # JVM; after a deliberate UI change: updateDebugScreenshotTest, look, commit
./gradlew connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.package=io.github.dontpanic345.tortoisespelling.<layer>
                                              # <layer>: data, component, integration, accessibility (emulator)
node --test 'scripts/*.test.mjs' 'jogging/*.test.mjs'   # script and Jogging crew tests (quote the globs)
node scripts/check-specs.mjs                  # tags on specs/*.feature
```

Web, e2e and push commands are in their READMEs and `package.json`s.

**Done** means the change meets [`CODING_STANDARDS.md`](CODING_STANDARDS.md) and the
checks for what you touched pass: Android unit tests and lint for any app change; the
instrumented layer covering it; `cd web && npm test && npm run typecheck` for web or
`golden/`; the e2e features a change touches (Android and web both, for a shared feature,
with both `check-steps` passing).

- **Connected tests and e2e wipe the app's data** on every attached device. Point
  `ANDROID_SERIAL` at an emulator, never at a phone with real data.
- **R8 is on for release.** Anything reflective that works in debug is re-checked on a
  release build (`npm run e2e:release` in `e2e/`; the debug-keystore recipe is in
  `e2e/README.md`).
- Keep e2e minimal: journeys and device-only behaviour; logic goes in unit tests.

## Architecture

**Wiring.** No DI framework. `TortoiseSpellingApp` builds an `AppContainer` (Room database,
`SettingsStore`, `WordRepository`, clock, fuzz). Composables reach it via
`rememberAppContainer()` (tests supply `LocalAppContainer`); each ViewModel has a companion
`factory(container, ...)`. Routes are strings in `ui/Nav.kt`; the `NavHost` is in
`MainActivity.kt`. `domain/` is pure Kotlin and holds the logic and most unit tests.
Screens with component tests split into a stateful `XScreen` and a stateless `XContent`.

**Dates are epoch days.** `dueOn`, `firstReviewedOn` and `reviewedOn` are
`LocalDate.toEpochDay()` (`domain/Days.kt`), rolling over at local midnight; names ending
`...At` are millis. Today comes from the `Clock` on `AppContainer` and the due-day fuzz is a
constructor parameter, so tests pin both. Only the reminder and backup timestamps read the
real time.

**Scheduling.** `reviewed` (`domain/Review.kt`) applies `Sm2Scheduler` (behind `Scheduler`)
and builds the log row; `WordRepository.recordReview` reads, applies and writes in one
transaction, and records nothing for a deleted word.
Correct first try is quality 5; correct only after the retype is 2, below SM-2's reset at 3,
so the word comes back tomorrow. The review is recorded at the first attempt, so abandoning
mid-correction still counts as a lapse, unless the user saves an edit from review's **Edit word**:
`undoReview` puts back the scheduling captured before the miss and deletes its log row, in one
transaction, and the word is asked again. A session is every due word plus the new-word
allowance, which counts words *introduced* today. Practice mode never writes scheduling
state or logs.

**Streak.** Days in `review_log` plus "satisfied" days (nothing was due) in `SettingsStore`,
recorded by Home and the reminder worker; they bridge a streak.

**Daily reminder** (`notify/`). The feature the app exists for.
- A self-rescheduling `OneTimeWorkRequest` aimed at a clock time: no periodic work, no
  exact alarms.
- App start calls `ReminderScheduler.ensureScheduled` with `KEEP`: WorkManager cold-starts
  the process to run the reminder, and a `REPLACE` there would cancel that very run.
  `REPLACE` is for Settings changes and the worker booking its next run.
- On by default. Android 13+ asks for the permission from Home once there is a word; a
  refusal turns reminders off, and Settings shows enabled AND granted.
- The notification's `startReview` extra is honoured only on a fresh launch (not with
  `savedInstanceState`, not from Recents), so a rotation never re-opens Review.

**Lookup.** Copy prompt puts `lookupPrompt(word)` on the clipboard for any chat AI;
`parsePastedLookup` validates the pasted reply (JSON between the outer braces, exact error
messages, `PasteLimits`, an example containing the exact form). After a valid paste, and in
the editor and the word list, `formWarnings` (`domain/FormWarnings.kt`, golden `warnings.json`)
flags a spaced form on a one-word root; warnings never reject and are never stored. The app
calls no AI API and has no Internet permission.

**Data safety.** Users' word lists and progress are the thing to protect.
- Room exports schemas to `app/schemas/` and has no destructive fallback. An entity change
  bumps `DATABASE_VERSION`, appends a real `Migration` to `ALL_MIGRATIONS` (a column drop
  copies version 3's table rebuild), and adds a `MigrationTest` that seeds the previous
  version and checks every column.
- Backups (`data/Backup.kt`) are one versioned JSON format for both apps. A format change
  adds a case in `golden/backup/` and updates `web/src/data/backup.ts` in the same commit.
  Import merges and never overwrites existing progress; old files (flat fields, no tree,
  `autoRefresh` keys) must keep importing.
- Auto Backup runs only when `cloudBackupEnabled` is on or the pass is a device-to-device
  transfer (`TortoiseSpellingBackupAgent`, `domain/BackupPolicy.kt`). The agent runs without
  `TortoiseSpellingApp`, so it reads `SettingsStore`'s SharedPreferences directly.

**Review screen details that look wrong but aren't.**
- The answer field is `KeyboardType.Password` so keyboards can't autocorrect or suggest;
  no `VisualTransformation`, so it isn't masked.
- The blank is a fixed `_____`. The blank and answer are the asked form's, and
  `hideWordInDefinition` scrubs every form from every definition on save.
- The speaker (`ui/review/Speaker.kt`) uses on-device voices only and the button is hidden
  when there are none. Debug builds wrap it in `RecordingSpeaker`, which is always ready and
  logs `spoke "<text>"` under `TortoiseSpeech` for e2e; the manifest `<queries>` entry lets
  Android 11+ see the TTS engine. The web button's `preventDefault` on `pointerdown` keeps
  the answer field focused, so the keyboard stays up.
- Word-list search matches the root and every form's spelling, never definitions.

**Generated files.** The launcher and notification icons and `docs/icon.svg` come from
`scripts/icon.mjs`; edit it and re-run (`icon.test.mjs` catches drift).

**Test tags.** `ui/TestTags.kt` tags are Appium resource-ids via `testTagsAsResourceId`
(dialogs and popups need their own). Mirror every tag in `e2e/support/testIds.ts`.

## Workflow

Work directly on main: no branches, no PRs. Commit and push each change as you go, once it is
**done** (see Checks).
A user-visible change adds a line under `[Unreleased]` in `CHANGELOG.md` in the same commit.
Dependabot PRs are merged or closed on GitHub; an update that can't be taken gets an
`ignore` in `.github/dependabot.yml` with the reason.

## Release

Pushing a version bump to main releases the APK: `release.yml` runs CI and the release
smoke, then publishes a signed build to GitHub Releases and creates the tag. Tags come only
from it. `node scripts/bump-version.mjs <minor|patch>` bumps the version and dates the
changelog; minor and patch bumps need no asking, Jogging included, and a major bump needs
Alan's say-so. The web app has no versions: `pages.yml` deploys it on push once `web.yml`
passes.
