# Piece: review-outcome

Move the rule that turns one answer into a word's new scheduling state and its log row out
of both repositories and into `domain/`, as one pure function with golden cases. Each
repository keeps only "read the word, apply the rule, write both rows" in one transaction.
Source: an architecture review with Alan on 2026-10-18 (its top candidate). There is no
separate design doc and no `spec` step: this spec was written in that session, and a
`spec-review` step checks it against the code.

## What it delivers

- `reviewed(...)` in `domain/Review.kt` and `web/src/domain/review.ts`: one place per app
  for grading, the scheduler call, the due day, lapse counting, `firstReviewedOn`,
  `isNew`, `lastReviewedAt` and the log row.
- `golden/review.json`, so the two apps are proved to agree on the whole outcome, not only
  on `Sm2Scheduler.next` (`sm2.json`), which is all that is golden today.
- Android's `recordReview` becomes one Room transaction. Today it is `wordById`, then
  `updateWord`, then `insertLog` with nothing around them: a process death between the two
  writes leaves a rescheduled word with no log row, so that day drops out of the streak.
- Android's `recordReview` takes a word id, like the web's, and records nothing for a word
  deleted since the session opened. Today it falls back to the session's snapshot
  (`dao.wordById(word.id) ?: word`), the `@Update` touches no row, and `insertLog` then
  breaks the `review_log` foreign key, which throws inside `viewModelScope.launch` and takes
  the app down. The web already records nothing (`repository.test.ts`, "for a deleted word
  writes no log row").

Nothing changes for a user except the two fixes above: no screen, copy, schema, backup
format or scheduling rule changes.

Goals it leans on:

- **1.** The review and its log row are written together or not at all.
- **4.** SM-2 state, grading and the session rules are unchanged; the golden cases pin
  today's behaviour, they don't change it.
- **5.** One rule, golden-tested on both runners, instead of two copies that could drift.
- **7.** No new dependency; the domain function follows `pickCard`/`wordProgress`, which
  already take `data.Word` (Kotlin) and `data/model`'s `Word` (TypeScript).

## Design

### The rule (pure, shared)

`app/.../domain/Review.kt`:

```kotlin
/** A word after one review, and the log row that records it. */
data class Reviewed(val word: Word, val log: ReviewLog)

/**
 * Apply one review to [word]. A first-try answer is [Grade.FIRST_TRY]; anything else is
 * [Grade.AFTER_RETYPE], which takes SM-2's lapse branch.
 */
fun reviewed(
    word: Word,
    correctFirstTry: Boolean,
    typedAnswer: String,
    today: Long,
    now: Long,
    fuzz: (today: Long, intervalDays: Int) -> Long,
    scheduler: Scheduler = Sm2Scheduler,
): Reviewed
```

It does exactly what `WordRepository.recordReview` (`data/WordRepository.kt`) does today
between the read and the writes:

- `quality` = `Grade.FIRST_TRY` if `correctFirstTry`, else `Grade.AFTER_RETYPE`.
- `next = scheduler.next(SrsState(repetitions, easeFactor, intervalDays), quality)`.
- The word: `next`'s three fields; `dueOn = fuzz(today, next.intervalDays)`;
  `lapses + 1` when `quality < RESET_BELOW_QUALITY`, else unchanged;
  `lastReviewedAt = now`; `firstReviewedOn = firstReviewedOn ?: today`; `isNew = false`.
  Every other field (`id`, `text`, `normalizedText`, `createdAt`, `suspended`) is kept.
- The log: `id = 0`, `wordId = word.id`, `reviewedAt = now`, `reviewedOn = today`,
  `grade = quality`, `correct = correctFirstTry`, `typedAnswer = typedAnswer.trim()`.

`web/src/domain/review.ts` mirrors it (file for file, per `web/README.md`):

```ts
export interface Reviewed<W extends Word> { word: W; log: Omit<ReviewLog, "id"> }

export function reviewed<W extends Word>(
  word: W, correctFirstTry: boolean, typedAnswer: string,
  today: number, now: number,
  fuzz: (today: number, intervalDays: number) => number,
  scheduler: Scheduler = sm2Scheduler,
): Reviewed<W>
```

Generic over `W` so the repository can pass a `StoredWord` and get its `content` back
untouched. `typedAnswer` is trimmed with `ktTrim`, as now. `domain/` may import types from
`data/model` (`cardPick.ts`, `queries.ts` already do), but not values.

`fuzz` stays a parameter, not a call to `fuzzedDueDay`, so both repositories keep passing
their injected fuzz and tests stay deterministic.

### Golden cases

`golden/review.json`, `{ "about": …, "reviewed": [ … ] }`. Each case has a `name`, `word` (fields as
in the README's word rule: only those it needs, the rest Kotlin's defaults), `correctFirstTry`,
`typedAnswer`, `today`, `now`, and `out` with `word` (every scheduling field:
`repetitions`, `easeFactor`, `intervalDays`, `dueOn`, `lapses`, `lastReviewedAt`,
`firstReviewedOn`, `isNew`, plus `suspended` and `id` where a case is about keeping them)
and `log` (every field but `id`). The fuzz in every case is the plain one,
`today + intervalDays`, so `dueOn` shows which interval reached it; the runners pass
`{ t, i -> t + i }`. Both runners compare `easeFactor` within `1e-9`, like `sm2.json`.

Cases, at least:

1. A new word answered first try: repetitions 1, interval 1, `dueOn` today + 1, lapses 0,
   `firstReviewedOn` today, `isNew` false, log grade 5 and `correct` true.
2. A new word missed (correct after the retype): repetitions 0, interval 1, ease 2.18,
   lapses 1, `firstReviewedOn` today, log grade 2 and `correct` false.
3. A word already reviewed (`firstReviewedOn` an earlier day): it keeps that day.
4. A third first-try review (repetitions 2, ease 2.7, interval 6): interval 17 and
   `dueOn` today + 17, proving the fuzz gets the new interval, not the old one.
5. A lapse from a long interval (repetitions 4, interval 40, lapses 2): repetitions 0,
   interval 1, lapses 3.
6. Ease at the 1.3 floor and missed again: stays 1.3.
7. `typedAnswer` with spaces and a tab around it: trimmed in the log; the inside kept.
8. A suspended word with `id` 7: `suspended` true and `id` 7 kept; the log's `wordId` 7.
9. `lastReviewedAt` is replaced by `now` when it was set before.

The Kotlin runner `golden/ReviewGoldenTest.kt` (with `everyFunctionHasARunner`, as the other
runners have) uses `Golden.forEachCase` and `Golden.wordFrom(c.getValue("word").jsonObject)`;
the TypeScript runner `web/test/golden/review.test.ts` uses `cases`, `expectFunctions` and
`wordFrom(c.word)` from `load.ts`. Add a `review.json` row to `golden/README.md`'s Files table
("`reviewed`: one review's word and log row"), and change its "Not golden" paragraph so it
says the repositories' reads and writes aren't golden, but the rule they apply is.

### Android

- `WordRepository.recordReview(wordId: Long, correctFirstTry: Boolean, typedAnswer: String)`:
  reads `today` and `now` from the clock, then calls a new DAO method:

  ```kotlin
  /** Apply [review] to the word and log it, in one transaction; false if the word is gone. */
  @Transaction
  suspend fun recordReview(id: Long, review: (Word) -> Reviewed): Boolean {
      val current = wordById(id) ?: return false
      val (word, log) = review(current)
      updateWord(word)
      insertLog(log)
      return true
  }
  ```

  with `review = { reviewed(it, correctFirstTry, typedAnswer, today, now, fuzz, scheduler) }`.
  The read is inside the transaction, so the stale-snapshot guard in today's comment still
  holds; the comment moves to the DAO method. The repository returns nothing (callers
  don't use the Boolean today; keep it on the DAO for the test).
- `ReviewViewModel.record` passes `word.id`.
- The unused imports in `WordRepository.kt` (`RESET_BELOW_QUALITY`, `SrsState`, and
  whatever else only `recordReview` used) go.

### Web

`repository.ts`'s `recordReview` keeps its transaction and its "a deleted word records
nothing" read, and replaces the inline grading, scheduler call, word spread and log object
with `const { word, log } = reviewed(current, correctFirstTry, typedAnswer, today, now, fuzz)`,
then the same two writes. Its imports of `Grade`, `sm2Scheduler`, `RESET_BELOW_QUALITY` and
`ktTrim` go if nothing else in the file uses them.

### Tests

- Golden: as above, both runners.
- Android JVM: `domain/ReviewTest.kt` only for what golden can't say: that `scheduler` is
  used (a fake `Scheduler` returning a fixed state) and `fuzz` receives
  `(today, next.intervalDays)` (a recording lambda).
- Android instrumented (`data/WordRepositoryTest.kt`):
  - `recordReviewWithAStaleSnapshotKeepsALaterWrite` now passes `stale.id`; it still passes.
  - New: a word deleted before `recordReview` writes no log row and doesn't throw
    (`reviewedCountOn(today)` is 0, the word count is unchanged).
  - New, on the DAO (`TortoiseSpellingDaoTest`): `recordReview` with a lambda that
    returns a changed word and a `ReviewLog` whose `wordId` points at a missing word makes
    `insertLog` fail on the foreign key; the word row must be unchanged afterwards, proving
    the `updateWord` before it was rolled back.
- Web: `test/data/repository.test.ts`'s `recordReview` tests pass unchanged. No new web
  repository test is needed; the rule's cases are golden.

### Docs

- `CLAUDE.md`, "Scheduling": `reviewed` (`domain/Review.kt`) applies `Sm2Scheduler` and
  builds the log row; `WordRepository.recordReview` reads, applies and writes in one
  transaction, and records nothing for a deleted word. Keep the rest of the paragraph.
- `golden/README.md`: as above.
- `CHANGELOG.md`, under `[Unreleased]`, `### Fixed`: a review is saved in one step, so a
  crash can't leave a word rescheduled with the day missing from the streak; and finishing
  a card whose word was deleted meanwhile no longer closes the app.
- `web/README.md` needs no change (its transaction rule already describes the web).

## What later pieces rely on

`reviewed` is the single place a review's outcome is decided, so a later piece that turns
the review session into a pure reducer in `domain/` (the architecture review's second
candidate) can emit a `record` effect that the repository satisfies with `recordReview`,
with no grading rule outside `domain/`.
