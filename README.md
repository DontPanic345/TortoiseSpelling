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
**Test key**. Settings has step-by-step instructions and a button that opens the
Anthropic console. Everything else — adding words by hand, reviewing, reminders —
works with no key and no network.

### Which model lookups use

There is no model picker. Lookups always run on the cheapest tier, chosen at
runtime from `GET /v1/models`: the newest model whose id marks it as the fast,
low-cost "haiku" tier. This means the app follows Anthropic's lineup on its own —
a newer Haiku is adopted with no update, a retired one is never picked, and a
lookup that 404s (model retired mid-session) re-runs discovery once. If discovery
fails or the tier is renamed, it falls back to `LookupModel.FALLBACK`
(`claude-haiku-4-5`) — a one-line bump in `ClaudeClient.kt`.

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
| Model choice | Settings dropdown (`claude-haiku-4-5` / `claude-sonnet-5` / `claude-opus-5`), user-changeable | No picker; cheapest tier resolved at runtime from `GET /v1/models` | Requested: one fewer decision, and the app keeps working as Anthropic's model lineup changes rather than pointing at an ID that will eventually retire. |
| Lookup uses the typed word verbatim | prompt asked for "the exact given word form" | prompt asks for the **corrected** spelling; the returned `word` replaces what was typed | A misspelling like "punchuation" otherwise produced a correct definition attached to the wrong spelling — the card taught the typo. The user can still edit the word back. |

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

## Verified on a real device

Debugger testing confirmed the review flow, the blank-the-word rendering, the
mandatory retype, and — the highest-risk item — that the answer field does **not**
autocorrect a misspelling (`autoCorrectEnabled = false` with `KeyboardType.Ascii`
holds up in practice).

One bug was found and fixed: a misspelled input ("punchuation") produced a correct
definition but the card kept the typo in the word field and example sentence. The
lookup now asks Claude for the corrected spelling and adopts it; see the deviations
table.

Still worth a manual check:

1. **The reminder fires.** Set the time a couple of minutes out and leave the app.
2. **Notification tap opens review**, including when the app is already running.
3. **Model discovery.** With a key set, the first lookup calls `GET /v1/models`; if
   that's blocked or slow, it should fall back to `claude-haiku-4-5` within ~10s
   rather than hanging.

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

`domain/` holds most of the pure logic and most of the 71 unit tests; the
model-selection and response-parsing tests live under `data/remote/`. `Srs.kt` sits
behind a `Scheduler` interface so FSRS can replace it later without the review UI
noticing.
