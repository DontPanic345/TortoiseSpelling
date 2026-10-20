# Edit after a miss

Fix a bad word entry from the review screen and have another go, without the miss
counting. Asked for by Alan on 20/10/2026 after a review asked for a word whose pasted
lookup was wrong; this is the design doc for the Jogging piece `edit-after-miss`.

## The problem

A lookup reply from a chat AI can be wrong: a misspelt form, a definition for the wrong
sense, an example that uses a different form. The user often first sees it in review. By
then they have typed an answer, missed because the entry was wrong, and the miss is
already recorded (`ReviewViewModel.gradeFirstAttempt` records at the first attempt, so
abandoning mid-correction still counts). The word drops to SM-2's lapse branch, its
interval resets to a day, its ease falls, and `lapses` goes up, for a mistake that was the
entry's, not the speller's. The only fix today is to finish the retype, leave review, find
the word in the word list and edit it; the lapse stays.

## What it delivers

- An **Edit word** button on the review screen once a first attempt has missed (the
  `Corrective` phase, revealed or not), in review and in practice.
- It opens the existing edit screen for that word (`Routes.edit(wordId)` on Android, the
  web's edit route), with the review session kept underneath.
- **Save** undoes the miss: the word's scheduling fields go back to what they were before
  the first attempt, and that attempt's `review_log` row is deleted, in one transaction.
  Review then shows the edited word again as a fresh card (`Prompting`), built from the
  new content by the usual card pick, and the next answer is graded as normal: right first
  try is quality 5, a miss is recorded as a miss.
- **Back without saving** changes nothing: the miss stands and the retype goes on.
- **Deleting the word** from the edit screen takes it out of the session; review moves on
  to the next card, or finishes.
- Leaving review after saving the edit but before answering again leaves the word as if it
  hadn't been reviewed today: still due, `firstReviewedOn` as before.

No schema, backup format or SM-2 rule changes. The button is not offered before the first
attempt (that would show the spelling) or after a correct answer (there's nothing to undo).

## Decisions

- **Undo, not defer.** Recording at the first attempt stays, so abandoning
  mid-correction still counts as a lapse. The edit undoes that one record instead.
- **Only a saved edit undoes.** Opening the edit screen and backing out is not a way to
  dodge a miss.
- **The retry is graded normally.** The user has seen the word by then, but the point is
  that the miss doesn't count; a correct retry scores as any first-try answer does.
- **Exact restore.** The undo writes back the scheduling fields captured before the review
  (`repetitions`, `easeFactor`, `intervalDays`, `dueOn`, `lapses`, `lastReviewedAt`,
  `firstReviewedOn`, `isNew`) and deletes the one log row by id. It never touches content,
  so it can run after the edit's save without losing it. It records nothing if the word
  is gone.
- **Ordering.** The edit screen must not open until the miss's write has finished, and
  the undo must read the row inside its transaction: the edit save writes the whole `Word`
  row from what it loaded (`WordRepository.updateWord`), so a stale load would otherwise
  write back pre-miss scheduling or clobber the undo.
- **Streak and allowance.** Deleting the log row can take today out of the streak and the
  word out of today's new-word count until the retry is recorded; that is correct, since
  the retry records it again.
- **Goal 4 exception.** Grading and SM-2 are unchanged, but the session rule "a miss is
  recorded at the first attempt" gains one exception: a miss undone by a saved edit.
  Approved by Alan; record it in `jogging/GOALS.md`'s decisions.

## Depends on

`review-outcome`. It moves the review rule into `domain/` (`reviewed(...)`) and makes
`recordReview` one transaction by word id. The undo builds on it: `recordReview` returns
what it needs (the log row's id and the word's state before), and `undoReview` is its
mirror in the same DAO and repository, with the same deleted-word guard, on both apps.

## Where it touches

- Android: `ui/review/ReviewViewModel.kt` (keep the before-state and log id of the
  current card's miss, the edit and return events, rebuilding the card), `ReviewScreen.kt`
  (the button; `ReviewContent` stays stateless), `MainActivity.kt` (navigate to edit from
  review and hand back saved or deleted), `data/WordRepository.kt` and
  `TortoiseSpellingDao.kt` (`undoReview`), `ui/TestTags.kt` and `e2e/support/testIds.ts`.
- Web: the same in `web/src/ui/review/`, `web/src/ui/router.ts`,
  `web/src/data/repository.ts`, `web/src/ui/testIds.ts`.
- Tests: ViewModel unit tests (save undoes and re-presents, back keeps the miss, delete
  skips, practice records nothing), repository tests on both apps (exact restore, log row
  gone, deleted word records nothing), a component test for the button's phases, and a
  shared scenario in `specs/review.feature`: miss a word, edit it, save, spell it right,
  and see it scheduled as a first-try success.
- Docs: `CLAUDE.md` "Scheduling" (the exception), `README.md` if it describes review, and
  `CHANGELOG.md` under `[Unreleased]`, `### Added`.

Release: `minor`.
