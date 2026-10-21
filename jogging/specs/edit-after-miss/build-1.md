# edit-after-miss/build-1: undo a review, on both apps' data layers

Build the rule and the data layer that take one review back: `undone` in `domain/` with
golden cases, `recordReview` returning what the undo needs, `undoReview` and `cardFor` in
both repositories, and their tests. No screen changes; build-2 (Android) and build-3 (web)
call these.

`review-outcome` is built: `reviewed(...)` is in `domain/Review.kt` and
`web/src/domain/review.ts`, `golden/review.json` has a `"reviewed"` array with runners
`golden/ReviewGoldenTest.kt` and `web/test/golden/review.test.ts`, and
`TortoiseSpellingDao.recordReview(id: Long, review: (Word) -> Reviewed): Boolean` reads the
word, applies `review`, `updateWord`s and `insertLog`s in one `@Transaction`, returning
false for a missing word. `WordRepository.recordReview(wordId, correctFirstTry,
typedAnswer)` returns `Unit` on Android and `Promise<void>` on the web, and records nothing
for a deleted word. Read those first.

## Design

### The undo rule (pure, shared)

`app/.../domain/Review.kt`, beside `reviewed`:

```kotlin
/**
 * [current] with its scheduling put back to [before]'s, to take one review back. Content
 * and everything else ([Word.id], [Word.text], [Word.normalizedText], [Word.createdAt],
 * [Word.suspended]) come from [current], so an edit saved since is kept.
 */
fun undone(current: Word, before: Word): Word
```

It copies exactly these eight fields from `before`: `repetitions`, `easeFactor`,
`intervalDays`, `dueOn`, `lapses`, `lastReviewedAt`, `firstReviewedOn`, `isNew`.

`web/src/domain/review.ts` mirrors it:

```ts
export function undone<W extends Word>(current: W, before: Word): W
```

returning `{ ...current, <the eight fields from before> }`, so a `StoredWord`'s `content`
is kept. `domain/` imports only types from `data/model`.

### Golden cases

`golden/review.json` gains an `"undone"` array beside `"reviewed"`. Each case has `name`,
`current` and `before` (words in the README's word rule: only the fields it needs, the
rest Kotlin's defaults) and `out` (every field the case is about). At least:

1. A new word's miss undone: `before` is new (`isNew` true, `firstReviewedOn` and
   `lastReviewedAt` null, repetitions 0, interval 0, lapses 0); `current` is after a miss
   (`isNew` false, `firstReviewedOn` today, `lastReviewedAt` set, ease 2.18, lapses 1,
   interval 1, `dueOn` today + 1). `out` has `before`'s values, nulls included.
2. A reviewed word's lapse undone (`before`: repetitions 4, interval 40, ease 2.6,
   lapses 2, `firstReviewedOn` an earlier day, `lastReviewedAt` set): every scheduling
   field back.
3. An edit saved since: `current` has a different `text` and `normalizedText`,
   `suspended` true, `id` 7 and a `createdAt`; `out` keeps all five from `current`.

Runners: `ReviewGoldenTest.kt` adds `"undone"` to `everyFunctionHasARunner`'s set and an
`undone()` test using `Golden.forEachCase` and `Golden.wordFrom`; `review.test.ts` adds it
to `expectFunctions` and a `describe.each(cases(file, "undone"))` using `wordFrom`. Compare
`easeFactor` within `1e-9`, like the `reviewed` cases. `golden/README.md`'s `review.json`
row becomes "`reviewed`, `undone`: one review's word and log row, and taking it back".

### Android data

`data/ReviewLog.kt`, after `ReviewLog`:

```kotlin
/** What it takes to undo one review: its log row, and the word as it was before. */
data class ReviewUndo(val wordId: Long, val logId: Long, val before: Word)
```

`TortoiseSpellingDao`:

- `recordReview(id, review)` returns `ReviewUndo?` instead of `Boolean`: null when the word
  is gone, else `ReviewUndo(id, insertLog(log), current)`, `current` being the row it read
  inside the transaction. Update its KDoc.
- New:

  ```kotlin
  @Query("DELETE FROM review_log WHERE id = :id")
  suspend fun deleteLog(id: Long)

  /**
   * Take one review back, in one transaction: the word's scheduling as it was and its log
   * row gone. Reads the row inside, as the edit just saved may have changed its content.
   * False, and nothing written, if the word is gone (its log went with it, by cascade).
   */
  @Transaction
  suspend fun undoReview(undo: ReviewUndo): Boolean {
      val current = wordById(undo.wordId) ?: return false
      updateWord(undone(current, undo.before))
      deleteLog(undo.logId)
      return true
  }
  ```

`WordRepository`:

- `suspend fun recordReview(wordId: Long, correctFirstTry: Boolean, typedAnswer: String): ReviewUndo?`
  returns the DAO's result. Its KDoc adds "Returns what [undoReview] needs to take it back,
  or null if the word is gone." `ReviewViewModel.record` ignores the result for now
  (build-2 keeps it).
- `suspend fun undoReview(undo: ReviewUndo) { dao.undoReview(undo) }`, KDoc: "Take back the
  review [recordReview] returned [undo] for. Content is untouched; a deleted word records
  nothing."
- `suspend fun cardFor(wordId: Long): ReviewCard?` = `dao.contentById(wordId)?.let(::pickCard)`,
  the pick `cardsFor` makes, for one word; null if the word is gone.

### Web data

`web/src/data/repository.ts`:

```ts
/** What it takes to undo one review: its log row, and the word as it was before. */
export interface ReviewUndo { wordId: number; logId: number; before: Word }
```

- `recordReview(wordId, correctFirstTry, typedAnswer): Promise<ReviewUndo | null>`: null
  for a deleted word, else `{ wordId, logId, before: scheduling(current) }`. `logId` is
  the key `tx.objectStore("reviewLog").add(...)` resolves to, still awaited together with
  the `put` inside the one transaction (`Promise.all`, then `await tx.done`).
- `undoReview(undo: ReviewUndo): Promise<void>`: one `["words", "reviewLog"]` readwrite
  transaction; read the word inside it; if gone, `await tx.done` and return; else
  `put(undone(current, undo.before))` and `delete(undo.logId)` on `reviewLog`, awaited
  together; then `await tx.done` and `notify()`, as `recordReview` does. Await only this
  transaction's own requests inside it.
- `cardFor(wordId: number): Promise<ReviewCard | null>`: the stored word, or null;
  `pickCard(scheduling(word), word.content, random)` as `cardsFor` does.

`web/src/ui/review/ReviewScreen.tsx` keeps `void repository.recordReview(...)`; build-3
uses the result.

## Tests

- Golden: the `undone` cases, both runners.
- Android instrumented, `data/TortoiseSpellingDaoTest`: the `recordReview` tests read the
  `ReviewUndo?` (null for a missing word; `before` equals the row read; `logId` is the id
  of the row now in `review_log`); the rollback test still passes. New: `undoReview` with a
  `ReviewUndo` for a missing word returns false.
- Android instrumented, `data/WordRepositoryTest`:
  - `anEditedMissIsUndone`: seed a reviewed due word (repetitions 2, interval 6,
    `firstReviewedOn` a week ago), `recordReview` a miss, `updateWord` it with a new text
    and definition, `undoReview`: every scheduling field equals the seed's, the text and
    content are the edit's, `reviewedCountOn(today)` is 0 and no log row is left.
  - `undoingANewWordsMissLeavesItNew`: `introducedOn(today)` is 0 afterwards (`todayPlan()`
    counts it new again) and the word is in `buildSession()`.
  - `undoForADeletedWordWritesNothing`: delete the word after the miss; `undoReview`
    doesn't throw and `wordCount()` is unchanged.
  - `cardFor` returns a card for the word's new content, and null for a missing id.
- Web, `test/data/repository.test.ts`: the same four, plus `recordReview` for a deleted word
  resolving to null.
