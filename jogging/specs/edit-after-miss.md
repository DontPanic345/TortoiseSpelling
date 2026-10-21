# Piece: edit-after-miss

Fix a bad word entry from the review screen and have another go, without the miss
counting. Source: [`docs/edit-after-miss.md`](../../docs/edit-after-miss.md), asked for by
Alan on 20/10/2026. Depends on `review-outcome`, whose spec this one assumes is built:
`reviewed(...)` in `domain/Review.kt` and `web/src/domain/review.ts`, Android's
`TortoiseSpellingDao.recordReview(id, review)` in one `@Transaction`, and
`WordRepository.recordReview(wordId, correctFirstTry, typedAnswer)` on both apps, which
records nothing for a deleted word. It also assumes `speak-word` is built: `ReviewContent`
already has `canSpeak` and `onSpeak` on both apps; this piece adds beside them.

## What it delivers

- An **Edit word** button on the review screen once a first attempt has missed (the
  `Corrective` phase, revealed or not), in review and in practice. Never in `Prompting`
  (it would show the spelling) or `Correct` (nothing to undo).
- It opens the existing edit screen for that word, with the review session kept underneath.
- **Save** undoes the miss: the word's scheduling fields go back to what they were before
  the first attempt and that attempt's `review_log` row is deleted, in one transaction.
  Review then shows the edited word again as a fresh card (`Prompting`), picked from the
  new content by the usual card pick, and the next answer is graded as normal.
- **Back without saving** changes nothing: the miss stands and the retype goes on.
- **Deleting the word** from the edit screen takes it out of the session; review moves on
  to the next card, or finishes.
- Leaving review after saving but before answering again leaves the word as if it hadn't
  been reviewed today: still due, `firstReviewedOn` as before.

No schema, backup format, SM-2 or grading change.

Goals and decisions it leans on:

- **1.** The undo writes the word and deletes the log row in one transaction, reads the
  row inside it, and never touches content, so it can't lose the edit it follows.
- **4.** Grading and SM-2 are unchanged. The session rule "a miss is recorded at the first
  attempt" gains one exception, a miss undone by a saved edit; Alan approved it in the
  design doc, and this step records it in `jogging/GOALS.md`'s decisions.
- **5.** The undo's field rule is one pure function per app with golden cases; the journey
  is a shared scenario in `specs/review.feature`.
- **7.** No new dependency. Android hands the edit's outcome back through the review
  entry's `SavedStateHandle`, Navigation's own idiom; the web keeps review mounted under a
  sub-route instead of adding a store.
- **Editing** (decision): the edit screen is the existing one, unchanged but for how it
  reports that it closed.

## Design

### The undo rule (pure, shared)

`domain/Review.kt`, beside `reviewed`:

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
is kept.

Golden: `golden/review.json` gains an `"undone"` array beside `"reviewed"`. Each case has
`name`, `current` and `before` (words in the README's word rule) and `out` (every field
the case is about). Cases, at least:

1. A new word's miss undone: `before` is new (`isNew` true, `firstReviewedOn` and
   `lastReviewedAt` null, repetitions 0, interval 0, lapses 0); `current` is after a miss
   (`isNew` false, `firstReviewedOn` today, `lastReviewedAt` set, ease 2.18, lapses 1).
   `out` has `before`'s values, nulls included.
2. A reviewed word's lapse undone (repetitions 4, interval 40, ease 2.6, lapses 2,
   `firstReviewedOn` an earlier day): every scheduling field back.
3. An edit saved since: `current` has a different `text`, `normalizedText` and
   `suspended` true; `out` keeps them, and `id` and `createdAt`, from `current`.

Runners: `golden/ReviewGoldenTest.kt` adds `"undone"` to `everyFunctionHasARunner` and an
`undone()` test using `Golden.wordFrom`; `web/test/golden/review.test.ts` the same with
`expectFunctions` and `wordFrom`. `golden/README.md`'s `review.json` row reads "`reviewed`,
`undone`: one review's word and log row, and taking it back".

### Android data

`data/ReviewLog.kt`, after `ReviewLog`:

```kotlin
/** What it takes to undo one review: its log row, and the word as it was before. */
data class ReviewUndo(val wordId: Long, val logId: Long, val before: Word)
```

`TortoiseSpellingDao`:

- `recordReview(id, review)` returns `ReviewUndo?` instead of `Boolean`: null when the word
  is gone, else `ReviewUndo(id, insertLog(log), current)` with `current` the row it read.
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
  returns the DAO's result. Its KDoc adds: "Returns what [undoReview] needs to take it back."
- `suspend fun undoReview(undo: ReviewUndo) { dao.undoReview(undo) }`.
- `suspend fun cardFor(wordId: Long): ReviewCard?` = `dao.contentById(wordId)?.let(::pickCard)`,
  the pick `cardsFor` makes, for one word; null if the word is gone.

### Web data

`web/src/data/repository.ts`:

```ts
/** What it takes to undo one review: its log row, and the word as it was before. */
export interface ReviewUndo { wordId: number; logId: number; before: Word }
```

- `recordReview(wordId, correctFirstTry, typedAnswer): Promise<ReviewUndo | null>`: null
  for a deleted word, else `{ wordId, logId, before: scheduling(current) }`, `logId` being
  the key `tx.objectStore("reviewLog").add(...)` resolves to (still awaited together with
  the `put`, inside the one transaction).
- `undoReview(undo: ReviewUndo): Promise<void>`: one `["words", "reviewLog"]` readwrite
  transaction; reads the word inside it; if gone, finishes the transaction and returns;
  else `put(undone(current, undo.before))` and `delete(undo.logId)` on `reviewLog`, awaited
  together; then `await tx.done` and `notify()`, as `recordReview` does.
- `cardFor(wordId: number): Promise<ReviewCard | null>`: the stored word, or null;
  `pickCard(scheduling(word), word.content, random)` as `cardsFor` does.

### Android screens

**Edit screen** (`ui/add/`). It reports how it closed:

- `AddWordViewModel.kt` adds `enum class EditOutcome { SAVED, DELETED }`.
  `AddWordUiState.dismissed: Boolean` becomes `closed: EditOutcome? = null`: a saved edit
  sets `SAVED`, `delete()` sets `DELETED`. Adding words never closes, as now.
- `AddWordScreen(editingId, onDone: () -> Unit, onClosed: (EditOutcome) -> Unit = { onDone() })`:
  `LaunchedEffect(state.closed) { state.closed?.let(onClosed) }`. `onDone` stays the back
  button; the system back pops through the `NavHost` as now, reporting nothing.

**Routes** (`ui/Nav.kt`): `const val EDIT_OUTCOME = "editOutcome"`, the
`SavedStateHandle` key the edit screen writes on the entry below it.

**`MainActivity.kt`**:

- The `EDIT` destination passes
  `onClosed = { outcome -> navController.previousBackStackEntry?.savedStateHandle?.set(Routes.EDIT_OUTCOME, outcome.name); navController.popBackStack() }`.
  Under the word list the key is set and never read; that is harmless.
- `REVIEW` and `PRACTICE` share a private composable `ReviewDestination(entry, practiceMode, navController, onFinished)`
  that reads `entry.savedStateHandle.getStateFlow<String?>(Routes.EDIT_OUTCOME, null)` with
  `collectAsStateWithLifecycle()` and calls `ReviewScreen` with
  `onEditWord = { id -> navController.navigate(Routes.edit(id)) { launchSingleTop = true } }`
  (a tap during the transition can't stack a second editor),
  `editOutcome = outcome?.let(EditOutcome::valueOf)` and
  `onEditOutcomeHandled = { entry.savedStateHandle[Routes.EDIT_OUTCOME] = null }`.

**`ReviewScreen`** gains those three parameters. It runs
`LaunchedEffect(state.openEdit) { state.openEdit?.let { onEditWord(it); viewModel.editOpened() } }`
and `LaunchedEffect(editOutcome) { editOutcome?.let { viewModel.onEditClosed(it); onEditOutcomeHandled() } }`,
and passes `onEditWord = viewModel::editWord` to `ReviewContent`.

**`ReviewContent`** stays stateless and gains `onEditWord: () -> Unit`. In `Feedback`'s
`Corrective` branch, the "Show answer" `TextButton` (unrevealed only) and a new
`TextButton(onClick = onEditWord, modifier = Modifier.testTag(TestTags.REVIEW_EDIT)) { Text("Edit word") }`
sit in one `Row`, after the "You typed" row and before the retype-missed line. The button
shows whenever the phase is `Corrective`, revealed or not.

**`ReviewUiState`** gains `openEdit: Long? = null`: the word id to open the editor for,
cleared by `editOpened()`.

**`ReviewViewModel`** keeps, privately:

- `recordJob: Job?`: `record` stores its launch.
- `undo: ReviewUndo?`: what the last `recordReview` returned (null in practice, where
  nothing is recorded, and for a deleted word).
- `editedWordId: Long?`: the word whose editor this ViewModel opened.
- `opening: Job?`: guards a double tap.

and adds:

- `editWord()`: ignored unless the phase is `Corrective`, there is a current card and
  `opening` isn't active. Sets `editedWordId` to the card's word id, then launches:
  `recordJob?.join()` (the edit's save writes the whole row, so the miss must be in it
  first), then `openEdit = wordId`.
- `editOpened()`: `openEdit = null`.
- `onEditClosed(outcome: EditOutcome)`: takes and clears `editedWordId`; ignored if it was
  null (a session rebuilt after process death) or isn't the current card's word.
  - `SAVED`: cancel `advanceJob`, set `loading = true`, then launch: if `undo?.wordId` is
    the word, `repository.undoReview(undo)`; clear `undo`; `repository.cardFor(wordId)`.
    A card replaces `queue[index]` with `loading = false`, `phase = Prompting`,
    `input = ""`, and is marked shown. Null (the word went meanwhile) removes it as
    `DELETED` does.
  - `DELETED`: remove `queue[index]`; `index` stays, `phase = Prompting`, `input = ""`,
    `loading = false`, `finished = index >= queue.size`; mark the new current card shown
    unless finished. The total drops, so the title reads e.g. "2 / 2" rather than
    pointing past a removed card.
- `advance()` clears `undo`.

Grading after a save is the usual `gradeFirstAttempt`, so a right answer records quality 5
and a miss records a miss, with a new `undo`.

**Tags**: `TestTags.REVIEW_EDIT = "review_edit"`; `e2e/support/testIds.ts` gains
`reviewEdit: 'review_edit'`. build-2 also adds `REVIEW_EDIT: "review_edit"` to
`web/src/ui/testIds.ts`: `web/test/ui/testIds.test.ts` fails when an Android tag has no
web twin, and CI runs it on build-2's push.

### Web screens

**Router** (`web/src/ui/router.ts`):

```ts
export type Route =
  | { name: "home" | "completion" | "add" | "words" | "settings" }
  | { name: "review" | "practice"; editing?: number }
  | { name: "edit"; id: number };
```

- `parseRoute` reads `#/review/edit/<id>` and `#/practice/edit/<id>` as
  `{ name, editing: id }` (safe integer, like `edit/<id>`); `routeHash` writes them back.
- New `export function screenKey(route: Route): string`: `routeHash` of the route without
  `editing`, so review stays mounted while its editor is open. `app.tsx` keys `Screen` by
  `screenKey(route)` and passes `editing={route.editing}` to `ReviewScreen`.

**Edit screen** (`web/src/ui/add/AddWordScreen.tsx`): `export type EditOutcome = "saved" | "deleted"`;
`AddWordScreen({ editingId, onClosed }: { editingId: number | null; onClosed?: (outcome: EditOutcome | null) => void })`.
With `onClosed`, every `back(...)` in the screen is replaced: the back button calls
`onClosed(null)`, a saved edit `onClosed("saved")`, delete `onClosed("deleted")`, and a word
missing on load `onClosed("deleted")`. Without it, behaviour is as now.

**`reviewState.ts`** (pure):

- `ReviewEffect` gains `{ openEdit: number }`.
- `editRequested(state)`: in `corrective` with a current card, `{ state, effects: [{ openEdit: card.word.id }] }`;
  otherwise idle.
- `editSaving(state)`: `loading: true`, no effects.
- `editedCard(state, card: ReviewCard | null)`: null is `wordRemoved(state)`; else
  `queue[index]` replaced, `loading: false`, `phase: prompting`, `input: ""`, effects
  `markShown(card)`.
- `wordRemoved(state)`: `queue[index]` removed, `index` kept, `loading: false`,
  `phase: prompting`, `input: ""`, `finished = index >= queue.length`, effects
  `markShown(queue[index])` unless finished.

**`ReviewScreen({ practiceMode, editing }: { practiceMode: boolean; editing?: number })`**:

- Refs: `opening: boolean`, `recorded: Promise<void>` (starts resolved), `undo: ReviewUndo | null`,
  `editedWord: number | null`.
- The `record` effect: `recorded.current = repository.recordReview(...).then((u) => { undo.current = u; })`.
- The `openEdit` effect: ignored while `opening.current` (a double tap); else
  `opening.current = true`, `editedWord.current = id`, then
  `void recorded.current.then(() => { opening.current = false; navigate({ name: practiceMode ? "practice" : "review", editing: id }); })`;
  the editor never opens before the miss is written.
- The `finished` effect also waits while `editing` is set (`editing` joins its deps):
  `back()` is an async `history.back()`, so a `replace({ name: "completion" })` run before
  the pop lands would overwrite the editor's entry, and the pop would then remount a
  fresh `#/review` session.
- On mount with `editing` set (a reload on `#/review/edit/5`), `replace` with the plain
  route: the miss it was for belonged to a session that is gone.
- While `editing` is set it renders `<AddWordScreen editingId={editing} onClosed={closeEdit} />`
  in place of `ReviewContent`.
- `closeEdit(outcome)`: takes and clears `editedWord`; if it is the current card's word:
  `"saved"` dispatches `editSaving`, calls `back({ name })`, then awaits
  `repository.undoReview(undo)` when `undo.current?.wordId` matches (clearing it) and
  dispatches `editedCard(s, await repository.cardFor(wordId))`; `"deleted"` dispatches
  `wordRemoved` and calls `back`. `null`, or no match, only calls `back`. The browser's
  own Back pops to `#/review` with nothing dispatched: the miss stands.
- `advance` (any transition that moves `index`) clears `undo.current`.

**`ReviewContent.tsx`** gains `onEditWord: () => void` and renders, in the corrective
feedback beside "Show answer",
`<button type="button" class="text-button" data-testid={TestIds.REVIEW_EDIT} onClick={onEditWord}>Edit word</button>`.
`TestIds.REVIEW_EDIT = "review_edit"` is already there (build-2 adds it with Android's tag,
so `testIds.test.ts` stays green).

On iOS the keyboard won't reopen by itself when review comes back from the editor (focus
outside a tap doesn't summon it); the field still takes focus and a tap opens it. That is
the platform, not a difference in behaviour.

### Tests

- Golden: the `undone` cases, both runners.
- Android instrumented, `data/`: `TortoiseSpellingDaoTest`'s `recordReview` tests read the
  `ReviewUndo?` (null for a missing word; `before` equals the row read; `logId` is the
  inserted row's). `WordRepositoryTest`: record a miss on a seeded reviewed word, save an
  edit (`updateWord` with new content and text), `undoReview`: every scheduling field
  equals the seed's, the text and content are the edit's, `reviewedCountOn(today)` is 0
  and no log row is left; `undoReview` for a deleted word doesn't throw and writes nothing;
  undoing a new word's miss leaves `introducedOn(today)` 0 and the word in `buildSession()`.
- Android integration, new `integration/EditAfterMissJourneyTest.kt` (`AppHarness`, real
  `NavHost`), seeding a reviewed due word (repetitions 2, interval 6, as
  `LapseJourneyTest`):
  - miss, **Edit word**, change the definition, **Save**: review shows the new
    definition, the answer field is empty, the title still reads "1 / 1"; spell it right:
    repetitions 3, lapses 0, one log row with `correct` true.
  - miss, **Edit word**, Back: the miss stands (`lapses` 1, one log row with `correct`
    false) and the "Not quite" feedback is still on screen.
  - with a second due word seeded: miss the first, **Edit word**, **Delete word**: the
    title reads "1 / 1", the second word's definition shows, and one word is left.
  - with only that word: miss, **Edit word**, **Delete word**: the session finishes to
    the completion screen.
  - miss, **Edit word**, **Save**, then **End session**: the word's scheduling equals the
    seed's and there are no log rows.
  - practice: miss, **Edit word**, **Save**: a fresh card with the new definition, and no
    log rows or scheduling change.
- Android component, `ReviewContentTest`: **Edit word** (`TestTags.REVIEW_EDIT`) exists in
  `Corrective` revealed and unrevealed, not in `Prompting` or `Correct`; a click calls
  `onEditWord` once.
- Android screenshots: `ReviewShot` passes `onEditWord = {}`; the two missed shots change,
  so `updateDebugScreenshotTest`, look, commit.
- Web: `test/data/repository.test.ts` mirrors the repository tests above;
  `test/ui/review/reviewState.test.ts` covers the four transitions (including removing the
  last card finishes, and `editRequested` in `prompting` and `correct` is idle);
  `test/ui/router.test.ts` covers the new hashes and `screenKey`;
  `test/ui/review/ReviewContent.test.tsx` the button's phases; and
  `test/ui/review/journeys.test.tsx` the save, back, delete (including the only word,
  which ends at `#/completion`) and practice journeys through `App`, as the integration
  tests do.
- Shared scenario in `specs/review.feature`, run by both apps, from existing steps only:

  ```gherkin
  Scenario: Fixing a wrong entry after a miss asks the word again
    Given I have added the word "necessary" defined as "a kind of fruit"
    And I go back to Home
    When I start today's session
    And I spell it "neccessary"
    Then I am told "Not quite"
    When I choose "Edit word"
    Then the title reads "Edit word"
    When I change the definition to "needed or required"
    And I save the changes
    Then the session title reads "1 / 1"
    And I am shown the definition "needed or required"
    When I spell it "necessary"
    Then I am told the correct word "necessary"
    And the session moves on by itself to the finish line
    And I see "You practised 1 word today."
  ```

  A new word's miss and first-try success both come back tomorrow, so the UI can't show
  the grade; the integration and web journey tests assert it on a reviewed word. That is
  where logic belongs (`CLAUDE.md`, "Keep e2e minimal").

### Docs

- `jogging/GOALS.md`, "Decisions already made", a new bullet (this step adds it):
  **Edit after a miss.** A miss undone by a saved edit from review is the one exception
  to "a miss is recorded at the first attempt" (goal 4); grading and SM-2 are unchanged.
  Approved by Alan on 20/10/2026.
- `CLAUDE.md`, "Scheduling": after "abandoning mid-correction still counts as a lapse",
  add "unless the user saves an edit from review's **Edit word**: `undoReview` puts back the
  scheduling captured before the miss and deletes its log row, in one transaction, and the
  word is asked again."
- `README.md`, the "Immediate correction" bullet: add "If the word itself was wrong, Edit
  word fixes it and the miss doesn't count."
- `CHANGELOG.md`, `[Unreleased]`, `### Added`: "**Edit word** after a miss in review: fix a
  wrong definition, form or example, and saving takes the miss back and asks the word
  again."
- `PRIVACY.md`: no change (nothing new is stored or sent).

### Steps

| Step | What | Model |
|---|---|---|
| build-1 | `undone`, golden cases, both repositories' `recordReview`/`undoReview`/`cardFor`, data tests | Opus, medium |
| build-2 | Android: edit outcome, nav, ViewModel, button, tags, component, integration and screenshot tests | Opus, medium |
| build-3 | Web: router sub-route, edit outcome, reducer, screen, button, tests | Opus, medium |
| build-4 | Shared scenario, `CLAUDE.md`, `README.md`, `CHANGELOG.md` | Sonnet, medium |
| review | The whole piece | Opus, medium |

`release`: `minor`.

## What later pieces rely on

- `recordReview` returns a `ReviewUndo` and `undoReview` takes it, on both apps: any later
  "take that answer back" (a typo-forgiveness button, say) uses the same pair.
- `undone` in `domain/` is the only place that says which fields are scheduling.
- The edit screen reports `SAVED`/`DELETED` (`"saved"`/`"deleted"` on the web), so another
  screen can open it and react, as review does.
- The web's `#/<route>/edit/<id>` sub-route with `screenKey` is how a screen keeps its
  state under the editor.
