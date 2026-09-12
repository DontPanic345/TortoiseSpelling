# Spellwise — Android app handoff

A native Android app for learning to spell words you don't already know. Built with the
intent that you continue in a **fresh Claude Code session on Windows** with Android Studio.

This document is self-contained. Read it top to bottom, then start at **Build plan**.

---

## 1. What we're building and why

The user wants to learn to spell unfamiliar words. They tried Anki and bounced off it for two
concrete reasons, both of which this app must solve:

1. **No reminders.** Anki desktop never prompted them to open it, so the habit never formed.
   → This app sends a **native local notification** once a day at a user-chosen time.
2. **Spaced repetition felt broken.** Adding a pile of cards dumped them all at once; the
   grading buttons weren't self-explanatory; there was no signal that a session was *finished*.
   → This app shows a hard **"All done — see you tomorrow"** screen. Small daily batches.
   Grading is implicit (you either spelled it right or you didn't).

### What actually works for spelling (design rationale, don't re-litigate)

- **Active production, not recognition.** The user must type the word from memory. No
  multiple choice, no "does this look right".
- **Retrieval + immediate corrective feedback.** Prompt → attempt → show correct spelling →
  **require a clean retype of the correct form before continuing** on a miss.
- **Spaced repetition over the user's own words.** The word list is words *they* chose. No
  built-in generic list.
- **Short daily sessions**, and a clear stopping point.

---

## 2. Decisions already made

| Decision | Choice | Notes |
|---|---|---|
| Platform | Native Android, Kotlin, Jetpack Compose | User builds in Android Studio on Windows |
| Min SDK | 26 (Android 8.0) | `compileSdk`/`targetSdk` 35 |
| SRS algorithm | **SM-2** (SuperMemo 2) | FSRS is a later upgrade — see §6 |
| Prompt style | Definition (+ part of speech) shown, target word blanked in an example sentence | |
| Grading | Implicit: correct-first-try / correct-after-retype / wrong | Maps to SM-2 quality — see §6 |
| Reminders | **Native local notification**, once daily, user-set time | WorkManager — see §7 |
| Claude integration | On "add word", call Claude for definition + example sentence | Raw HTTPS, see §8 |
| Lookup model | **`claude-haiku-4-5`** | User-changeable in Settings; default Haiku |
| API key storage | `EncryptedSharedPreferences`, entered in Settings | Tradeoff accepted — see §8 |
| DI | Manual (`AppContainer` on the `Application`) | No Hilt, keep it lean |
| JSON | `org.json` (built in) for the Claude response; `kotlinx-serialization` for export/import | |
| HTTP | OkHttp | |

### Package / naming
- Application ID: `com.falloon.spellwise` (change if you like; it's cosmetic)
- App name: **Spellwise**

---

## 3. Environment (Windows session)

- Android Studio is installed at `C:\Program Files\Android\Android Studio`.
- Android SDK is at `C:\Users\fallo\AppData\Local\Android\Sdk` (has build-tools, platform-tools,
  platforms, emulator, system-images already).
- User: `fallo`.
- Suggested project path: `C:\Users\fallo\AndroidStudioProjects\Spellwise`.
- For the Claude API call: **invoke the `claude-api` skill** and read `java/claude-api/README.md`
  before writing the network code, to confirm current model IDs, the `anthropic-version`
  header value, and whether to use structured outputs. Do not trust this file's API snippet
  blindly — verify against the skill.

---

## 4. Data model (Room)

```kotlin
@Entity(tableName = "words")
data class Word(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val text: String,                 // the word to be spelled — stored lowercased, trimmed
    val definition: String,           // must NOT contain the word or an obvious derivative
    val example: String,              // one sentence containing the exact word form; may be ""
    val partOfSpeech: String? = null,

    val createdAt: Long = System.currentTimeMillis(),

    // --- SM-2 state ---
    val repetitions: Int = 0,         // consecutive successful reviews (n)
    val easeFactor: Double = 2.5,     // EF, clamped >= 1.3
    val intervalDays: Int = 0,        // I
    val dueOn: Long = LocalDate.now().toEpochDay(),  // epoch DAY, not millis
    val lapses: Int = 0,
    val lastReviewedAt: Long? = null,
    val isNew: Boolean = true,        // never had a first review
    val suspended: Boolean = false
)

@Entity(tableName = "review_log")
data class ReviewLog(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val wordId: Long,
    val reviewedAt: Long,             // millis
    val reviewedOn: Long,             // epoch day — for streak/stats queries
    val grade: Int,                   // 0 = wrong, 3 = right-after-retype, 5 = right first try
    val correct: Boolean,
    val typedAnswer: String
)
```

Store a couple of scalars in `EncryptedSharedPreferences` or a small `settings` table /
DataStore:
- `apiKey: String`
- `lookupModel: String` (default `claude-haiku-4-5`)
- `newWordsPerDay: Int` (default 10)
- `reminderHour: Int`, `reminderMinute: Int` (default 08:00)
- `reminderEnabled: Boolean` (default true)
- `currentStreak: Int`, `lastStudiedOn: Long` (epoch day) — or derive streak from `review_log`

### Key DAO queries
- Due today: `SELECT * FROM words WHERE suspended = 0 AND isNew = 0 AND dueOn <= :today ORDER BY dueOn`
- New allowance: `SELECT * FROM words WHERE suspended = 0 AND isNew = 1 ORDER BY createdAt LIMIT :remainingNewToday`
  where `remainingNewToday = newWordsPerDay - (count of review_log rows today where the word was new)`.
  Simplest correct approach: count distinct `wordId` in `review_log` where `reviewedOn = today`
  AND that word's first-ever log is today.
  Acceptable simplification for v1: `newWordsPerDay - (words with isNew=0 AND date(lastReviewedAt)=today)`.
- Due count for the notification: `SELECT COUNT(*)` of (due today) + `min(newWordsPerDay, new words available)`.

---

## 5. Screens (Compose + Navigation-Compose)

### 5.1 Home / Today  `route: "home"`
- Big number: **words to practice today** (due + today's new allowance).
- Primary button **Start** → `review`. Disabled when count is 0.
- When count is 0: show the completion state inline (see 5.3) instead of an empty "Start".
- Secondary: current streak ("🔥 4 days"), "reviewed today: N".
- Top-bar overflow: Add word, All words, Settings.

### 5.2 Review  `route: "review"`
Builds a session queue at entry: all due words + up to `remainingNewToday` new words, shuffled
(keep new words interleaved, not all last).

For each item:
- Show `partOfSpeech` (italic) + `definition`.
- If `example` is non-empty: show it with the target word replaced by
  `"_ ".repeat(word.length).trim()` — **case-insensitive** match on the exact word form. If the
  word form isn't found in the sentence, show the sentence hidden and just render the blanks
  standalone with a caption "type the word".
- A single `OutlinedTextField`, autofocused. **Critical keyboard config:**
  ```kotlin
  KeyboardOptions(
      autoCorrectEnabled = false,
      capitalization = KeyboardCapitalization.None,
      keyboardType = KeyboardType.Password, // TYPE_TEXT_VARIATION_VISIBLE_PASSWORD: the
                                            // one flag Gboard + Samsung both honour
      imeAction = ImeAction.Done
  )
  ```
  `KeyboardType.Ascii` + `autoCorrectEnabled = false` were tried first but Gboard and
  Samsung Keyboard ignore both, still autocorrecting misspellings and offering the word
  in the suggestion strip. `KeyboardType.Password` does not mask the text on its own —
  Compose only masks when you also set a password `VisualTransformation`, which we don't
  — so the user still sees their attempt for the diff.
- Progress: "3 / 12".

On submit (trim, compare case-insensitively to `word.text`):
- **Correct:**
  - Green highlight, reveal the full word and the un-blanked example.
  - Auto-advance after ~1s, **or** show one "Continue" button. Grade = 5.
  - (Optional nicety: a tiny "that was easy / that was hard" only if you want EF nuance;
    v1 can skip it and always use 5 for a clean first-try correct.)
- **Incorrect:**
  - Red highlight. Show a **character-level diff**: render the correct word, and under/over it
    the user's attempt, highlighting the first index where they diverge (and any length diff).
    A simple LCS or just first-divergence index is enough.
  - Show the definition still. The text field clears and the user must **retype the correct
    spelling exactly** to proceed (accept only an exact match now). Grade = 3 if they get the
    retype on the first try after the miss, else still 3 (don't over-engineer). Internally treat
    as a lapse for SM-2 (quality < 3 branch) — see §6. `lapses += 1`.
- Write a `ReviewLog` row for every attempt outcome (one per word per session is fine).
- Apply SM-2, persist the `Word`, update streak.

When the queue empties → navigate to `completion` (pop `review`).

### 5.3 Completion  `route: "completion"` (also rendered inline on Home when nothing is due)
- "**All done — see you tomorrow** 🎉"
- "You practiced **N** words today."
- Streak.
- "Next review: **tomorrow**" / "in 3 days" — compute from `MIN(dueOn)` over non-suspended
  non-new words.
- Small, de-emphasized text link **"Practice a few more anyway"** → a free-practice mode that
  pulls random words and does **not** touch SM-2 state or logs. Keep it visually minor so it
  doesn't undermine the "you're done" message.

### 5.4 Add word  `route: "add"`
- `TextField` for the word.
- Button **"Look up with Claude"** → calls the API (§8) on `Dispatchers.IO`, shows a spinner,
  fills `definition`, `example`, `partOfSpeech` into **editable** fields.
  - Disabled (with hint) if no API key set or offline.
- All three fields are always editable — user can write them by hand and never call Claude.
- **Save** inserts a `Word` with `isNew = true`, `dueOn = today`.
- After save, keep the screen open with fields cleared and focus back on the word field
  ("Add another"). A small "Added ✓ (12 total)" confirmation.
- **Nice-to-have (v1.1):** "Paste a list" mode — a multiline field, one word per line, enqueues
  background lookups with a visible progress row and lets the user review/prune results.

### 5.5 Word list  `route: "words"`
- `LazyColumn` of all words: the word, its state ("new" / "due today" / "in 5d" / "suspended"),
  small definition preview.
- Search field (filter by `text` contains).
- Tap → edit screen (same form as Add, pre-filled; can also re-run Claude lookup).
- Swipe actions: suspend/unsuspend, delete (confirm delete).

### 5.6 Settings  `route: "settings"`
- **API key** — `TextField`, masked by default with a show/hide toggle. Stored via
  `EncryptedSharedPreferences`. Never log it. A "Test key" button fires a 1-token request and
  reports OK / 401 / other.
- **Lookup model** — dropdown: `claude-haiku-4-5` (default), `claude-sonnet-5`, `claude-opus-5`.
- **New words per day** — stepper, default 10.
- **Daily reminder** — enable toggle + time picker (default 08:00). Changing it reschedules the
  worker (§7). On Android 13+, tapping enable triggers the `POST_NOTIFICATIONS` runtime
  permission request.
- **"Send a test notification"** button.
- **Export / Import** — write/read a JSON file of all words (+ SRS state) via the Storage
  Access Framework (`ACTION_CREATE_DOCUMENT` / `ACTION_OPEN_DOCUMENT`). Uses
  `kotlinx-serialization`. Good for backup and for the user not losing their list.

---

## 6. SM-2 scheduler

Pure function, no Android deps — put it in `domain/Srs.kt` and unit-test it.

```kotlin
data class SrsState(val repetitions: Int, val easeFactor: Double, val intervalDays: Int)

/**
 * @param quality 0..5. For this app:
 *   5 = correct on the first attempt
 *   3 = correct only after being shown the answer and retyping   (still the "lapse" branch)
 *   0 = wrong and gave up   (not used yet — retype is mandatory — reserved)
 * Anything < 3 resets repetitions and schedules the word for tomorrow.
 */
fun sm2(prev: SrsState, quality: Int): SrsState {
    // EF is always updated
    val ef = (prev.easeFactor +
        (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))
        .coerceAtLeast(1.3)

    if (quality < 3) {
        return SrsState(repetitions = 0, easeFactor = ef, intervalDays = 1)
    }
    val reps = prev.repetitions + 1
    val interval = when (reps) {
        1 -> 1
        2 -> 6
        else -> Math.round(prev.intervalDays * ef).toInt().coerceAtLeast(1)
    }
    return SrsState(repetitions = reps, easeFactor = ef, intervalDays = interval)
}
```

Applying it after a review:
```kotlin
val q = if (correctFirstTry) 5 else 3
val next = sm2(SrsState(word.repetitions, word.easeFactor, word.intervalDays), q)
val updated = word.copy(
    repetitions = next.repetitions,
    easeFactor = next.easeFactor,
    intervalDays = next.intervalDays,
    dueOn = LocalDate.now().plusDays(next.intervalDays.toLong()).toEpochDay(),
    lapses = word.lapses + if (q < 3) 1 else 0,
    lastReviewedAt = System.currentTimeMillis(),
    isNew = false
)
```

Notes:
- Grade `3` deliberately still lands in the `quality < 3` reset branch (because `3 < 3` is
  false — wait). **Careful:** with the code above, `q = 3` does NOT reset. If you want a
  fumbled word to reset to tomorrow, pass `q = 2` for "correct after retype". Decide and be
  consistent. Recommended: **`q = 2` for correct-after-retype** so it comes back tomorrow, and
  keep the doc comment honest. Update the mapping to `val q = if (correctFirstTry) 5 else 2`.
- First-ever review of a new word: `prev = SrsState(0, 2.5, 0)`.

### FSRS (future upgrade, not now)
FSRS-4.5/5 gives better intervals but needs the weight vector and a stability/difficulty model.
Ship SM-2, keep `Srs.kt` behind a small interface (`Scheduler`) so FSRS can be dropped in later
without touching the review UI.

---

## 7. Daily reminder (WorkManager)

Why WorkManager over `AlarmManager`: it survives reboot automatically, no exact-alarm
permission dance on Android 12+, and "within a few minutes of the target time" is fine for a
habit nudge.

- `PeriodicWorkRequestBuilder<ReminderWorker>(1, TimeUnit.DAYS)` with an `initialDelay`
  computed as the millis from now until the next occurrence of `reminderHour:reminderMinute`.
- Enqueue with `ExistingPeriodicWorkPolicy.UPDATE` and a stable unique name `"daily-reminder"`.
  Re-enqueue whenever the user changes the time or toggles it in Settings.
- `ReminderWorker.doWork()`:
  1. Open the DB, compute the practice-today count (§4).
  2. If `reminderEnabled` and count > 0 → post a notification:
     - channel `"reminders"` (create on app start, importance DEFAULT)
     - title: "Time to practice spelling"
     - text: `"$count word${if (count==1) "" else "s"} ready"`
     - tap → `PendingIntent` to `MainActivity` with an extra that deep-links to `review`
       (or `home`).
  3. If count == 0 → post nothing.
- Manifest: `<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>` and
  request it at runtime on Android 13+ (API 33) from Settings / first launch.
- `INTERNET` permission for the API call.
- No `RECEIVE_BOOT_COMPLETED` needed (WorkManager handles reboot).

Also refresh/re-assert the periodic work in `Application.onCreate()` so a killed schedule
self-heals.

---

## 8. Claude integration (add-word lookup)

**Before writing this, invoke the `claude-api` skill and skim `java/claude-api/README.md`** to
confirm the header value and model ID are current. Snapshot as of this handoff:

- `POST https://api.anthropic.com/v1/messages`
- Headers:
  - `x-api-key: <the user's key>`
  - `anthropic-version: 2023-06-01`
  - `content-type: application/json`
- Body:

```json
{
  "model": "<lookupModel, default claude-haiku-4-5>",
  "max_tokens": 400,
  "system": "You write concise spelling-flashcard content. Given a single word, return a JSON object with keys: \"definition\" (a clear dictionary-style gloss, under 25 words, that does NOT contain the target word or an obvious derivative of it), \"example\" (ONE natural sentence that uses the exact given word form verbatim), \"partOfSpeech\" (e.g. noun, verb, adjective). Return ONLY the JSON object, no prose, no code fence.",
  "messages": [
    { "role": "user", "content": "Word: accommodate" }
  ]
}
```

- Run on `Dispatchers.IO` via a coroutine. Use OkHttp.
- Parse: `root.getJSONArray("content").getJSONObject(0).getString("text")` → find the first
  `{` … last `}` → `JSONObject` → read `definition`, `example`, `partOfSpeech`. Be lenient:
  if parsing fails, surface the raw text in the definition field for the user to fix by hand.
- Handle `stop_reason == "refusal"` on the response: tell the user Claude declined this word
  and let them fill the fields manually.
- HTTP errors:
  - `401` → "API key rejected — check it in Settings."
  - `429` → "Rate limited — try again in a moment."
  - `5xx` / timeout / no network → "Couldn't reach Claude — you can type the definition
    yourself."
- Optional hardening (later): switch to structured outputs (`output_config.format` with a JSON
  schema) once you've confirmed the exact wire shape from the skill. The "return ONLY JSON"
  prompt approach above is robust enough for v1.

### API key storage tradeoff (tell the user, don't silently decide)
The key lives in `EncryptedSharedPreferences` on the device. That's standard for a personal
single-user app. It is **not** safe to publish this app or share the APK with the key in it,
and a fully compromised/rooted phone could expose the key — if that happens the user rotates
it in the Anthropic console. No backend, no proxy, by choice.

Dependency note: `androidx.security:security-crypto` latest is an alpha
(`1.1.0-alpha06`) but it's widely used and fine here. Alternative: plain DataStore + a
manually managed key in the Android Keystore.

---

## 9. Dependencies (`app/build.gradle.kts`)

Use a version catalog (`gradle/libs.versions.toml`). Rough set (let Studio pick current
versions when you scaffold via the New Project wizard, then add):

- `androidx.core:core-ktx`
- Compose BOM + `ui`, `material3`, `ui-tooling-preview`, `material-icons-extended`
- `androidx.activity:activity-compose`
- `androidx.lifecycle:lifecycle-viewmodel-compose`, `lifecycle-runtime-compose`
- `androidx.navigation:navigation-compose`
- `androidx.room:room-runtime`, `room-ktx`; `room-compiler` via **KSP**
- `androidx.work:work-runtime-ktx`
- `androidx.datastore:datastore-preferences` (or security-crypto — see §8)
- `androidx.security:security-crypto`
- `com.squareup.okhttp3:okhttp`
- `org.jetbrains.kotlinx:kotlinx-serialization-json` (+ the serialization plugin)
- `org.jetbrains.kotlinx:kotlinx-coroutines-android`
- test: `junit`, `kotlinx-coroutines-test`, `androidx.room:room-testing`

Plugins: `com.android.application`, `org.jetbrains.kotlin.android`,
`com.google.devtools.ksp`, `org.jetbrains.kotlin.plugin.serialization`.

---

## 10. Suggested source layout

```
com.falloon.spellwise
├── SpellwiseApp.kt            // Application; builds AppContainer; creates notif channel; re-enqueues worker
├── di/AppContainer.kt         // db, repo, settings, okHttpClient, claudeClient
├── MainActivity.kt            // sets Compose content, NavHost, handles deep-link extra
├── data/
│   ├── Word.kt  ReviewLog.kt
│   ├── SpellwiseDao.kt
│   ├── SpellwiseDatabase.kt
│   ├── SettingsStore.kt       // EncryptedSharedPreferences / DataStore wrapper
│   └── remote/ClaudeClient.kt // suspend fun lookup(word): LookupResult
├── domain/
│   ├── Scheduler.kt           // interface
│   ├── Srs.kt                 // SM-2 impl of Scheduler
│   └── SessionBuilder.kt      // builds the review queue for today
├── ui/
│   ├── theme/
│   ├── home/HomeScreen.kt + HomeViewModel.kt
│   ├── review/ReviewScreen.kt + ReviewViewModel.kt + Diff.kt
│   ├── complete/CompletionScreen.kt
│   ├── add/AddWordScreen.kt + AddWordViewModel.kt
│   ├── words/WordListScreen.kt + WordListViewModel.kt
│   └── settings/SettingsScreen.kt + SettingsViewModel.kt
└── notify/
    ├── ReminderWorker.kt
    └── ReminderScheduler.kt   // enqueue/cancel/reschedule helpers
```

ViewModels get the `AppContainer` via a simple `viewModelFactory { }` — no Hilt.

---

## 11. Build plan (do it in this order)

1. **Scaffold.** Android Studio → New Project → Empty Activity (Compose), name Spellwise,
   package `com.falloon.spellwise`, min SDK 26, Kotlin DSL. Confirm it builds and runs on an
   emulator.
2. **Dependencies + plugins** (§9). Add KSP and serialization plugins. Sync, confirm build.
3. **Data layer.** `Word`, `ReviewLog`, DAO, `SpellwiseDatabase`. Write an instrumented or
   in-memory Room test that inserts and queries "due today".
4. **SRS.** `Srs.kt` + `Scheduler` interface. **Unit test it** against the SM-2 examples
   (new word → 1d → 6d → ~15d; a lapse resets to 1d). This is pure and quick to get right.
5. **Settings store.** API key + prefs. Settings screen with the key field and model dropdown.
   "Test key" button (1-token request) proves the network path end to end.
6. **Add word + Claude lookup.** `ClaudeClient.lookup()`, the Add screen, manual-entry
   fallback. You can now populate a real word list.
7. **Review flow.** `SessionBuilder`, `ReviewScreen`, the blank-the-word rendering, the
   keyboard config, correct/incorrect handling, character diff, mandatory retype, SM-2 apply,
   `ReviewLog` write, streak update.
8. **Completion screen** + wiring Home to show it when nothing is due.
9. **Home screen** — counts, Start button, streak.
10. **Notifications.** Channel, `POST_NOTIFICATIONS` request, `ReminderWorker`,
    `ReminderScheduler`, reschedule on Settings change, re-assert in `Application.onCreate`.
    Test with a reminder time 2 minutes out.
11. **Word list** screen — browse, search, edit, suspend, delete.
12. **Export / import** JSON.
13. **Polish** — empty states, error toasts/snackbars, dark theme, app icon.

### Acceptance criteria (v1 is "done" when)
- [ ] Add a word with Claude filling definition + example; also add one fully by hand offline.
- [ ] Review shows definition + blanked example; wrong answer forces a correct retype.
- [ ] Getting words right pushes them out (1d → 6d → longer); a miss brings it back tomorrow.
- [ ] When the queue is empty: "All done — see you tomorrow" with the real next-review date.
- [ ] A daily notification fires at the set time and only when words are actually due; tapping
      it opens the review screen.
- [ ] Killing and reopening the app preserves everything; the reminder still fires the next day.
- [ ] `Srs.kt` has passing unit tests.

---

## 12. Open questions (decide as you go, none block starting)

- Correct-after-retype grade: recommend `q = 2` (back tomorrow). See §6.
- Should "Practice a few more" ever touch scheduling? Recommend **no** — pure practice.
- Interleave vs. new-words-last in the session queue: recommend light interleave.
- One `ReviewLog` row per word per session, or one per attempt? Per session is enough for
  streak + basic stats.
