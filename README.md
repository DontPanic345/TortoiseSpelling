# Spellwise

A native Android app for learning to spell words you don't already know. Built from
[HANDOFF.md](HANDOFF.md), which remains the design rationale — read it for *why* the
app works the way it does. This file records what was built and where it departs from
that plan.

## Running it

Open the project in Android Studio and run, or from a terminal:

```bash
./gradlew assembleDebug
```

```bash
./gradlew testDebugUnitTest
```

The APK lands in `app/build/outputs/apk/debug/`. To install on a running emulator or
attached device:

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Before lookup works, open **Settings** and paste an Anthropic API key, then press
**Test key**. Everything else — adding words by hand, reviewing, reminders — works
with no key and no network.

## Departures from HANDOFF.md

Each of these was a deliberate call, not an oversight.

| Area | Handoff said | Built as | Why |
|---|---|---|---|
| `compileSdk` / `targetSdk` | 35 | 36 | Only android-35/36/36.1 are installed and AGP 8.13 caps at 36. |
| OkHttp | 5.x | 4.12.0 | `okhttp-android` 5.5.0 requires compiling against API 37, which isn't installed. |
| API key storage | `EncryptedSharedPreferences` | AES-GCM under an Android keystore key (`SecretCipher`) | `androidx.security:security-crypto` reached 1.1.0 stable but is now **deprecated with no successor**. The handoff named this as the alternative. |
| Settings storage | DataStore *or* security-crypto | One `SharedPreferences` file; only the key is encrypted | Resolves the handoff's ambiguous "or". Non-secrets stay readable in a bug report. |
| New-word allowance | `newWordsPerDay − (words with isNew=0 AND lastReviewedAt=today)` | `newWordsPerDay − (words with firstReviewedOn=today)` | The handoff's own "acceptable simplification" counts **every** word reviewed today, because every review clears `isNew`. A fifteen-word review day would have silently dropped the new-word allowance to zero. |
| Correct-after-retype grade | 3 | 2 | SM-2 resets on `quality < 3`, so 3 would not have taken the lapse branch the handoff documented for it. The handoff spots this mid-sentence and recommends 2. |
| Daily reminder | `PeriodicWorkRequest` | Self-rescheduling `OneTimeWorkRequest` | A periodic request re-fires 24h after each *actual* run, so every Doze delay permanently shifts the reminder later. Re-targeting an absolute clock time each run keeps it pinned. |
| Blanking the target word | replace the word in the sentence | whole-word match via letter/digit lookarounds | Substring matching blanks "ate" inside "plate". |
| Intervals | uncapped, unfuzzed | capped at 365 days, fuzzed above a week | Words added together and answered alike otherwise stay clumped on the same due dates forever, producing empty days beside unmanageable ones. |

### Additions the handoff didn't specify

- **Duplicate detection.** A unique index on the normalized word text, enforced on both
  add and rename, so the same word can't enter the list twice.
- **Cascading delete.** `review_log` has a foreign key to `words`, so deleting a word
  takes its history with it instead of orphaning rows.
- **Room schema export, no destructive migration.** Schemas are checked in under
  `app/schemas/`. `fallbackToDestructiveMigration()` is deliberately *not* enabled: it
  would silently wipe the word list, the one thing the user cannot recreate.
- **Versioned backup format.** The export JSON carries a `version`, and an import from
  a newer version is refused with an explanation rather than half-read. Import merges:
  words already present keep their local scheduling, so restoring an old backup never
  quietly undoes progress.

### Decisions the handoff left open (§12)

- **Day rollover: local midnight.** A session at 00:30 counts as a new day.
- **A day with nothing due bridges the streak** rather than breaking it. The app said
  there was nothing to do; it must not then punish you for believing it. Zero-due days
  are recorded by the reminder worker too, so this holds even if the app is never opened.
- **A missed word does not come back later in the same session.** The mandatory retype
  is the corrective repetition, and an open-ended session would undermine the clear
  stopping point the app exists to provide.
- **Free practice touches nothing** — no SM-2, no review log, no streak.

## What still needs a real device

The unit tests cover the scheduling, text and backup logic (59 tests, all pure JVM).
Three things can only be confirmed by hand:

1. **The keyboard must not autocorrect.** This is the single highest-risk behaviour in
   the app: if the IME silently repairs a misspelling, the exercise is worthless. The
   field sets `autoCorrectEnabled = false` with `KeyboardType.Ascii`, which is the
   strongest lever available without masking the text (`KeyboardType.Password` would
   hide what you typed, defeating the point). Gboard's behaviour cannot be fully
   guaranteed from the app side — **type a deliberate misspelling and confirm it stands.**
2. **The reminder fires.** Set the time a couple of minutes out and leave the app.
3. **Notification tap opens review**, including when the app is already running.

## Layout

```
com.falloon.spellwise
├── SpellwiseApp.kt         Application; builds AppContainer, creates the channel,
│                           re-asserts the reminder schedule
├── MainActivity.kt         NavHost; handles the reminder deep-link extra
├── di/AppContainer.kt      Manual dependency graph (no Hilt)
├── data/                   Room entities, DAO, repository, settings, backup,
│   └── remote/             ClaudeClient — raw Messages API over OkHttp
├── domain/                 Pure, unit-tested: SM-2, day maths, blanking, diff, queue
├── ui/                     Compose screens, one package per screen
└── notify/                 Reminder worker and scheduler
```

`domain/` holds everything pure and is where the tests live. `Srs.kt` sits behind a
`Scheduler` interface so FSRS can replace it later without the review UI noticing.
