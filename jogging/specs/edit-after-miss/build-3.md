# edit-after-miss/build-3: web, Edit word after a miss

Mirror Android's **Edit word** in the web app: after a miss, open the edit screen with the
review session kept underneath, and on return undo the miss and ask the word again (save),
keep the miss (back) or drop the word from the session (delete). No docs or changelog
(build-4). Follow `web/README.md`.

Already built: `review-outcome` (`reviewed` in `web/src/domain/review.ts`), `speak-word`
(`ReviewContent.tsx` has `canSpeak` and `onSpeak`), and build-1 of this piece, in
`web/src/data/repository.ts`:

- `export interface ReviewUndo { wordId: number; logId: number; before: Word }`.
- `recordReview(wordId, correctFirstTry, typedAnswer): Promise<ReviewUndo | null>` (null
  for a deleted word), `undoReview(undo): Promise<void>` (one transaction, scheduling only,
  nothing for a deleted word) and `cardFor(wordId): Promise<ReviewCard | null>`.

Android has the same behaviour from build-2 (`ui/review/ReviewViewModel.kt`); read it, the
two must agree.

## Rules

- The button shows in the `corrective` phase, revealed or not, in review and practice;
  never in `prompting` or `correct`.
- The editor must not open until the miss's write has finished.
- Only a saved edit undoes. Back (the top bar's or the browser's) changes nothing: the
  miss stands and the retype goes on.
- After a save the word is asked again as a fresh `prompting` card from the new content,
  graded as normal: right is quality 5, a miss records a miss.
- Delete takes the word out of the session; review moves on or finishes.
- Practice records nothing, so it has nothing to undo; save still re-presents the card.

## Design

**Router** (`web/src/ui/router.ts`):

```ts
export type Route =
  | { name: "home" | "completion" | "add" | "words" | "settings" }
  | { name: "review" | "practice"; editing?: number }
  | { name: "edit"; id: number };
```

- `parseRoute` reads `#/review/edit/<id>` and `#/practice/edit/<id>` as
  `{ name, editing: id }` (a safe integer, like `edit/<id>`); `routeHash` writes them back.
  `#/review` and `#/practice` parse to routes with no `editing`, as now.
- New `export function screenKey(route: Route): string`: `routeHash` of the route without
  `editing`, so review stays mounted while its editor is open. `app.tsx` keys `Screen` by
  `screenKey(route)` (update its comment) and passes `editing={route.editing}` to
  `ReviewScreen`.

**Edit screen** (`web/src/ui/add/AddWordScreen.tsx`): `export type EditOutcome = "saved" | "deleted"`;
`AddWordScreen({ editingId, onClosed }: { editingId: number | null; onClosed?: (outcome: EditOutcome | null) => void })`.
With `onClosed`, every `back(...)` in the screen is replaced: the back button calls
`onClosed(null)`, a saved edit `onClosed("saved")`, delete `onClosed("deleted")`, and a word
missing on load `onClosed("deleted")`. Without it, behaviour is exactly as now.

**`reviewState.ts`** (pure):

- `ReviewEffect` gains `{ openEdit: number }`.
- `editRequested(state)`: in `corrective` with a current card,
  `{ state, effects: [{ openEdit: card.word.id }] }`; otherwise idle.
- `editSaving(state)`: `loading: true`, no effects.
- `editedCard(state, card: ReviewCard | null)`: null is `wordRemoved(state)`; else
  `queue[index]` replaced by `card`, `loading: false`, `phase: { kind: "prompting" }`,
  `input: ""`, effects `markShown(card)`.
- `wordRemoved(state)`: `queue[index]` removed, `index` kept, `loading: false`,
  `phase: { kind: "prompting" }`, `input: ""`, `finished = index >= queue.length`, effects
  `markShown(queue[index])` unless finished.

**`ReviewScreen({ practiceMode, editing }: { practiceMode: boolean; editing?: number })`**:

- Refs: `opening: boolean`, `recorded: Promise<void>` (starts `Promise.resolve()`), `undo: ReviewUndo | null`,
  `editedWord: number | null`.
- The `record` effect: `recorded.current = repository.recordReview(...).then((u) => { undo.current = u; })`.
- The `openEdit` effect: ignored while `opening.current` (a double tap would push two
  editor entries); else `opening.current = true`, `editedWord.current = id`, then
  `void recorded.current.then(() => { opening.current = false; navigate({ name: practiceMode ? "practice" : "review", editing: id }); })`.
- The `finished` effect returns early while `editing` is set, and `editing` joins its
  deps. `closeEdit` dispatches before `back()`'s `history.back()` has landed, so when the
  removed card was the last, a `replace({ name: "completion" })` run at once would
  overwrite the editor's history entry and the pending pop would then remount a fresh
  `#/review` session. Waiting for the pop to clear `editing` avoids it.
- `dispatch` clears `undo.current` whenever `index` changes (it already clears the timer
  there).
- On mount with `editing` set (a reload on `#/review/edit/5`), `replace` with the plain
  route: the miss it was for belonged to a session that is gone.
- While `editing` is set it renders `<AddWordScreen editingId={editing} onClosed={closeEdit} />`
  in place of `ReviewContent`; its state and timers stay in the screen.
- `closeEdit(outcome)`: takes and clears `editedWord`; if it is the current card's word:
  `"saved"` dispatches `editSaving`, calls `back({ name })`, then awaits
  `repository.undoReview(undo)` when `undo.current?.wordId` matches (clearing it) and
  dispatches `editedCard(s, await repository.cardFor(wordId))`; `"deleted"` dispatches
  `wordRemoved` and calls `back({ name })`. `null`, or no match, only calls
  `back({ name })`. The browser's own Back pops to `#/review` with nothing dispatched.

**`ReviewContent.tsx`** gains `onEditWord: () => void` and, in the corrective feedback
beside "Show answer" (and alone once revealed), before the retype-missed line, renders
`<button type="button" class="text-button" data-testid={TestIds.REVIEW_EDIT} onClick={onEditWord}>Edit word</button>`.
Lay the two buttons out side by side in `styles.css` if they need it. `ReviewScreen`
passes `onEditWord={() => dispatch(editRequested)}`.

**Test ids**: `TestIds.REVIEW_EDIT = "review_edit"` is already in `web/src/ui/testIds.ts`:
build-2 added it beside Android's `TestTags.REVIEW_EDIT`, as `testIds.test.ts` demands.

On iOS the keyboard won't reopen by itself when review comes back from the editor; the
field still takes focus and a tap opens it. Don't remount the answer field to force it.

## Tests

- `test/ui/router.test.ts`: the two new hashes round-trip, a bad id falls back to home,
  and `screenKey` is the same for `#/review` and `#/review/edit/5` and differs from
  `#/practice`.
- `test/ui/review/reviewState.test.ts`: `editRequested` emits `openEdit` in `corrective`
  (revealed and not) and is idle in `prompting` and `correct`; `editedCard` replaces the
  card, resets to `prompting` and marks it shown; `editedCard(s, null)` and `wordRemoved`
  drop the card, keep `index`, and finish when it was the last.
- `test/ui/review/ReviewContent.test.tsx`: the button (`TestIds.REVIEW_EDIT`) shows in
  corrective revealed and not, not in prompting or correct; a click calls `onEditWord`.
- `test/ui/add/` (`journeys.test.tsx` or a new test): with `onClosed`, save reports
  `"saved"`, delete `"deleted"`, back `null`, and none of them navigates.
- `test/ui/review/journeys.test.tsx`, through `App` like the existing journeys, seeding a
  reviewed due word (repetitions 2, interval 6):
  - miss, Edit word, change the definition, save: the new definition shows, `location.hash`
    is `#/review`, the title reads "1 / 1"; spell it right: repetitions 3, lapses 0, one
    log row with `correct` true.
  - miss, Edit word, `history.back()`: "Not quite" shows, lapses 1, one log row with
    `correct` false.
  - two due words: miss the first, Edit word, delete: the second word's card shows,
    "1 / 1".
  - one due word: miss, Edit word, delete: `location.hash` ends at `#/completion` and
    stays there (the race the `finished` guard prevents).
  - miss, Edit word, save, then End session: scheduling equals the seed's, no log rows.
  - practice: miss, Edit word, save: the new definition shows, no log rows.
- `cd web && npm test && npm run typecheck` pass.
