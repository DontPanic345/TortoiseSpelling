# review-outcome/build-2: both repositories apply it; Android in one transaction

Everything under "Android" and "Web" below, the instrumented tests, `CLAUDE.md` and
`CHANGELOG.md`. The rule is already built (build-1). No screen, tag, text or screen order
changes.

The integration layer covers the review journeys (`LapseJourneyTest`,
`PracticeJourneyTest`, `StreakJourneyTest`), which call `recordReview` through the screen.

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


## Acceptance

```bash
./gradlew assembleRelease
# The rule lives only in domain/.
! grep -n "RESET_BELOW_QUALITY\|Grade\." app/src/main/java/io/github/dontpanic345/tortoisespelling/data/WordRepository.kt web/src/data/repository.ts
```
