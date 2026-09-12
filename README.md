# TortoiseSpelling

A native Android app for learning to spell words you don't already know. You build
your own word list, and the app drills you on it with spaced repetition, active
recall, and a once-a-day reminder so the habit actually sticks.

## How it works

- **Your words, not a canned list.** You add the words you want to learn. Claude can
  fill in the definition and an example sentence, or you can type them yourself.
- **You spell it from memory.** Each review shows the definition, part of speech, and
  an example sentence with the word blanked out. You type the word — no multiple
  choice, no "does this look right".
- **Immediate correction.** Get it wrong and the app shows the correct spelling with a
  character-level diff marking where you diverged, then makes you retype it correctly
  before moving on.
- **Spaced repetition (SM-2).** Words you spell correctly move further out (1 day →
  6 days → longer); a miss brings the word back tomorrow. Intervals are capped at a
  year and lightly fuzzed so words added together don't clump on the same days.
- **A real finish line.** Sessions are small and end with an explicit
  "All done — see you tomorrow" screen showing when the next review is due. An
  optional "practice a few more" mode pulls random words without touching your
  schedule.
- **Daily reminder.** One local notification at a time you choose, and only when
  words are actually due. Tapping it opens straight into review.

Everything except word lookup works fully offline with no account and no API key.

## Screens

| Screen | What it does |
|---|---|
| **Home / Today** | Count of words to practice, a Start button, current streak, words reviewed today. |
| **Review** | The drill: definition + blanked example, one text field, progress counter, diff + mandatory retype on a miss. |
| **Completion** | "All done" state with the real next-review date and an optional free-practice link. |
| **Add word** | Type a word, optionally "Look up with Claude", edit any field, Save. Stays open to add another. |
| **Word list** | Browse and search all words with their state (new / due / in N days / suspended); tap to edit, swipe to suspend or delete. |
| **Settings** | API key + Test key, new words per day, daily reminder time and toggle, test notification, JSON export / import. |

## Word lookup with Claude

Adding a word can call the Anthropic Messages API to generate the definition,
example sentence, and part of speech. Claude also corrects the spelling of the word
you typed, so a misspelled entry still produces a correct card.

- Lookups always run on the cheapest (Haiku-tier) model, chosen automatically from
  `GET /v1/models` — the app follows Anthropic's lineup with no updates needed, and
  falls back to `claude-haiku-4-5` if discovery fails.
- The API key is stored on-device, encrypted with an Android keystore key. There is
  no backend or proxy. Don't share the APK with your key in it; if a key is exposed,
  rotate it in the Anthropic console.
- If lookup fails (no key, offline, rate limited, refused), you can always fill the
  fields in by hand.

To enable it: open **Settings**, paste an Anthropic API key, and press **Test key**.
Settings has step-by-step instructions and a button that opens the Anthropic console.

### Data safety

- Word text is uniquely indexed, so the same word can't be added twice.
- Deleting a word takes its review history with it (no orphaned rows).
- Room schemas are checked in and destructive migration is disabled — an app update
  will never silently wipe your word list.
- Backup export carries a version; importing a newer-format backup is refused rather
  than half-read. Import merges: words you already have keep their local scheduling,
  so restoring an old backup never undoes progress.

## Running it

Requirements: Android Studio (or the Android SDK + JDK 17), an emulator or device on
Android 8.0 (API 26) or newer.

Open the project in Android Studio and press Run, or from a terminal:

```bash
./gradlew assembleDebug
```

```bash
./gradlew testDebugUnitTest
```

The debug APK lands in `app/build/outputs/apk/debug/`. To install it on a running
emulator or attached device:

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### Live-API integration test

`ClaudeIntegrationTest` exercises the real lookup flow and is skipped unless an API
key is present in the environment:

```bash
TORTOISESPELLING_ANTHROPIC_KEY=sk-ant-... ./gradlew testDebugUnitTest
```

## Project layout

```
com.falloon.tortoisespelling
├── TortoiseSpellingApp.kt         Application; builds AppContainer, creates the notification
│                           channel, re-asserts the reminder schedule
├── MainActivity.kt         NavHost; handles the reminder deep-link extra
├── di/AppContainer.kt      Manual dependency graph (no Hilt)
├── data/                   Room entities, DAO, repository, settings, backup
│   └── remote/             ClaudeClient — raw Messages API over OkHttp
├── domain/                 Pure, unit-tested logic: SM-2, day maths, word blanking,
│                           spelling diff, session queue
├── ui/                     Compose screens, one package per screen
└── notify/                 Reminder worker and scheduler
```

`domain/` holds most of the pure logic and the bulk of the unit tests; the
model-selection and response-parsing tests live under `data/remote/`. `Srs.kt` sits
behind a `Scheduler` interface so a different algorithm (e.g. FSRS) can replace it
later without the review UI noticing.

## Tech

Kotlin, Jetpack Compose, Navigation-Compose, Room (with KSP), WorkManager, OkHttp,
kotlinx-serialization. `compileSdk` / `targetSdk` 36, `minSdk` 26. Manual DI.

## License

MIT — see [LICENSE](LICENSE).
