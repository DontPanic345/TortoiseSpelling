# edit-after-miss/build-2: Android, Edit word after a miss

Add **Edit word** to Android's review screen after a miss, open the edit screen with the
session kept underneath, and on return undo the miss and ask the word again (save), keep
the miss (back) or drop the word from the session (delete). Includes the tags, component,
integration and screenshot tests. No docs or changelog (build-4).

Already built: `review-outcome` (`reviewed` in `domain/Review.kt`; `recordReview(wordId, …)`
in one transaction), `speak-word` (`ReviewContent` has `canSpeak` and `onSpeak`), and
build-1 of this piece:

- `data class ReviewUndo(val wordId: Long, val logId: Long, val before: Word)` in
  `data/ReviewLog.kt`.
- `WordRepository.recordReview(wordId, correctFirstTry, typedAnswer): ReviewUndo?` (null if
  the word is gone), `undoReview(undo: ReviewUndo)` (one transaction, scheduling only,
  nothing for a deleted word) and `cardFor(wordId: Long): ReviewCard?` (the usual pick,
  null if the word is gone).

## Rules

- The button shows in the `Corrective` phase, revealed or not, in review and practice;
  never in `Prompting` or `Correct`.
- The edit screen must not open until the miss's write has finished: its save writes the
  whole `Word` row from `repository.wordById` (`AddWordViewModel.save` →
  `WordRepository.updateWord`).
- Only a saved edit undoes. Back, by the top bar or the system, changes nothing: the miss
  stands and the retype goes on.
- After a save the word is asked again as a fresh `Prompting` card from the new content,
  graded as normal (`gradeFirstAttempt`): right is quality 5, a miss records a miss.
- Delete takes the word out of the session; review moves on or finishes.
- Practice records nothing, so it has nothing to undo; save still re-presents the card.

## Design

**Edit screen** (`ui/add/`):

- `AddWordViewModel.kt` adds `enum class EditOutcome { SAVED, DELETED }`.
  `AddWordUiState.dismissed: Boolean` becomes `closed: EditOutcome? = null`: a saved edit
  (`UpdateResult.Updated`) sets `SAVED`, `delete()` sets `DELETED`. Adding never closes.
- `AddWordScreen(editingId, onDone: () -> Unit, onClosed: (EditOutcome) -> Unit = { onDone() })`:
  `LaunchedEffect(state.closed) { state.closed?.let(onClosed) }`. `onDone` stays the top
  bar's back; the system back pops through the `NavHost`, reporting nothing.

**Routes** (`ui/Nav.kt`): `const val EDIT_OUTCOME = "editOutcome"`, the `SavedStateHandle`
key the edit screen writes on the entry below it.

**`MainActivity.kt`**:

- The `EDIT` destination passes
  `onClosed = { outcome -> navController.previousBackStackEntry?.savedStateHandle?.set(Routes.EDIT_OUTCOME, outcome.name); navController.popBackStack() }`.
  Under the word list the key is set and never read; that is harmless.
- `REVIEW` and `PRACTICE` share a private composable
  `ReviewDestination(entry: NavBackStackEntry, practiceMode: Boolean, navController: NavHostController, onFinished: () -> Unit)`
  that reads `entry.savedStateHandle.getStateFlow<String?>(Routes.EDIT_OUTCOME, null)` with
  `collectAsStateWithLifecycle()` and calls `ReviewScreen` with `onQuit` as now,
  `onEditWord = { id -> navController.navigate(Routes.edit(id)) { launchSingleTop = true } }`
  (a tap during the transition can't stack a second editor),
  `editOutcome = outcome?.let(EditOutcome::valueOf)` and
  `onEditOutcomeHandled = { entry.savedStateHandle[Routes.EDIT_OUTCOME] = null }`.

**`ReviewScreen`** gains `onEditWord: (Long) -> Unit`, `editOutcome: EditOutcome?` and
`onEditOutcomeHandled: () -> Unit`. It runs
`LaunchedEffect(state.openEdit) { state.openEdit?.let { onEditWord(it); viewModel.editOpened() } }`
and `LaunchedEffect(editOutcome) { editOutcome?.let { viewModel.onEditClosed(it); onEditOutcomeHandled() } }`,
and passes `onEditWord = viewModel::editWord` to `ReviewContent`.

**`ReviewContent`** stays stateless and gains `onEditWord: () -> Unit`. In `Feedback`'s
`Corrective` branch, the "Show answer" `TextButton` (unrevealed only, as now) and a new
`TextButton(onClick = onEditWord, modifier = Modifier.testTag(TestTags.REVIEW_EDIT)) { Text("Edit word") }`
sit in one `Row`, after the "You typed" row (and the revealed "Correct" row) and before
the retype-missed line.

**`ReviewUiState`** gains `openEdit: Long? = null`: the word id to open the editor for,
cleared by `editOpened()`.

**`ReviewViewModel`** keeps, privately:

- `recordJob: Job?`: `record` stores its launch, and its body is
  `undo = repository.recordReview(word.id, correctFirstTry, typed)`.
- `undo: ReviewUndo?`: what the last `recordReview` returned (stays null in practice).
- `editedWordId: Long?`: the word whose editor this ViewModel opened.
- `opening: Job?`: guards a double tap.

and adds:

- `editWord()`: ignored unless the phase is `Corrective`, there is a current card and
  `opening` isn't active. Sets `editedWordId` to the card's word id, then
  `opening = viewModelScope.launch { recordJob?.join(); _state.update { it.copy(openEdit = wordId) } }`.
- `editOpened()`: `openEdit = null`.
- `onEditClosed(outcome: EditOutcome)`: takes and clears `editedWordId`; ignored if it was
  null (a session rebuilt after process death) or isn't the current card's word.
  - `SAVED`: cancel `advanceJob`, set `loading = true`, then launch: if `undo?.wordId` is
    the word, `repository.undoReview(it)`; clear `undo`; `repository.cardFor(wordId)`.
    A card replaces `queue[index]` with `loading = false`, `phase = Prompting`,
    `input = ""`, and goes through `markShown`. Null (the word went meanwhile) removes it
    as `DELETED` does.
  - `DELETED`: remove `queue[index]`; `index` stays, `phase = Prompting`, `input = ""`,
    `loading = false`, `finished = index >= queue.size`; `markShown` the new current card
    unless finished. The total drops, so the title stays truthful.
- `advance()` clears `undo`.

The existing comment in `gradeFirstAttempt` ("Recorded at the miss…") gains: "A saved
edit from Edit word takes it back (`onEditClosed`)."

**Tags**: `TestTags.REVIEW_EDIT = "review_edit"`; `e2e/support/testIds.ts` gains
`reviewEdit: 'review_edit'` beside the other review ids, and `web/src/ui/testIds.ts`'s
`TestIds` gains `REVIEW_EDIT: "review_edit"` (unused until build-3):
`web/test/ui/testIds.test.ts` fails when an Android tag has no web twin, and CI runs the
web suite on this push. Run `cd web && npm test` before pushing.

## Tests

- Component, `component/ReviewContentTest`: **Edit word** (`TestTags.REVIEW_EDIT`) exists
  in `Corrective` revealed and unrevealed, not in `Prompting` or `Correct`; a click calls
  `onEditWord` once. Pass `onEditWord` wherever the test builds `ReviewContent`.
- Integration, new `integration/EditAfterMissJourneyTest.kt` (`AppHarness`, the real
  `NavHost`), seeding a reviewed due word as `LapseJourneyTest` does (repetitions 2,
  interval 6, `dueOn` today, `firstReviewedOn` a week ago). Change the definition through
  `TestTags.ADD_WORD_DEFINITION` and save with `TestTags.ADD_WORD_SAVE`.
  - miss, **Edit word**, change the definition, save: the new definition shows, the
    title reads "1 / 1"; spell it right: repetitions 3, lapses 0, `dueOn` past today, one
    log row `LogRow(correct = true, typedAnswer = "necessary")`.
  - miss, **Edit word**, the top bar's back: "Not quite" is on screen, `lapses` 1, one log
    row with `correct` false.
  - with a second due word seeded: miss the first, **Edit word**, **Delete word**: the
    title reads "1 / 1", the second word's definition shows, one word is left.
  - with only that word: miss, **Edit word**, **Delete word**: the session finishes to
    the completion screen.
  - miss, **Edit word**, save, then **End session**: the word's scheduling equals the
    seed's and there are no log rows.
  - practice (Home's practice entry, as `PracticeJourneyTest` reaches it): miss, **Edit
    word**, save: the new definition shows, no log rows, scheduling unchanged.
- Screenshots: `ReviewShot` in `Screenshots.kt` passes `onEditWord = {}`. The two missed
  shots change: run `./gradlew updateDebugScreenshotTest`, look at the new references,
  commit them, and `validateDebugScreenshotTest` passes.
- Lint, unit tests, and the `component` and `integration` instrumented layers pass.
