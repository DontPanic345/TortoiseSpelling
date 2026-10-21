# review-outcome/build-1: the rule and its golden cases on both apps

`domain/Review.kt`, `web/src/domain/review.ts`, `golden/review.json`, both runners, the
`golden/README.md` changes and `domain/ReviewTest.kt`. The repositories don't call the
rule yet. No screen, tag, text or screen order changes.

Write each golden case's `out` from what today's `recordReview` does before writing
`reviewed`. Read the code for it, so the cases describe the current behaviour.

Prove the cases bite, then revert each change:

- Drop `?: today` from `firstReviewedOn` (Kotlin) and `?? today` (TypeScript): cases 1
  and 2 fail on each runner. Write `today` in its place: case 3 fails.
- Pass the old `intervalDays` to `fuzz`: case 4 fails on each runner.

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

### Tests

- Golden: as above, both runners.
- Android JVM: `app/src/test/java/.../domain/ReviewTest.kt` only for what golden can't say:
  that `scheduler` is used (a fake `Scheduler` returning a fixed state) and `fuzz` receives
  `(today, next.intervalDays)` (a recording lambda).

The repositories, their instrumented tests, `CLAUDE.md` and `CHANGELOG.md` are build-2's:
leave `WordRepository.kt`, `TortoiseSpellingDao.kt` and `repository.ts` as they are.

### Docs

- `golden/README.md`: the Files row and the "Not golden" paragraph, as above.
