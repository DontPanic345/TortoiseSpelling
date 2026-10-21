# form-warnings/build-3: Web: warnings on the add screen and the Check forms badge

The web mirror of build-2 (Android). Show `formWarnings` (built in build-1,
`web/src/domain/formWarnings.ts`) on the add/edit screen and the word list. Warnings never
block Save and are never stored.

Built already (build-1): `interface FormWarning { definition: number; form: number; message: string }`
and `formWarnings(word: string, content: WordContent): FormWarning[]`: forms (never the base
form) whose trimmed spelling has whitespace, on a root whose trimmed spelling has none, in
content order, with the message
"“most curious” is more than one word. Spelling review asks for one word."
Android's `ui/add/AddWordScreen.kt` and `ui/words/WordListScreen.kt` (build-2) are the
behaviour to match.

## Design

- `web/src/ui/add/AddWordContent.tsx`:
  - The paste dialog: after the `<p class="support">` holding the summary, when the result
    is valid, one `<p class="warning">` per warning from `formWarnings(result.word,
    result.content)`, before the "This answer is for…" and "Using it replaces…" lines.
  - The editor: compute `formWarnings(ktTrim(state.text), state.content)` once per render
    and pass each non-base form editor its `warning: string | null` by `(d, f)`. Its `Field`
    gets `error={formMissing || warning !== null}` and `support={formMissing ? "Required" :
    warning}`. Live from what is on screen, so a hand-typed form is marked and a fix clears
    it at once.
  - A `.warning` rule in the stylesheet in the error colour the `Field` error uses.
- `web/src/ui/words/wordListState.ts`: `WordRow` gains `checkForms: boolean`, which
  `filterRows` sets to `formWarnings(w.text, w.content).length > 0`.
- `web/src/ui/words/WordListContent.tsx`: when `row.checkForms`, after the status badge,
  `<span class="status-badge check-forms" data-testid={wordRowCheckForms(word.normalizedText)}>Check forms</span>`,
  styled with the error-container colours.
- `web/src/ui/testIds.ts` already has `wordRowCheckForms` (build-2 added it with Android's
  `TestTags.wordRowCheckForms`, since `web/test/ui/testIds.test.ts` checks every Android
  tag has a web twin); import it from there.
- `web/test/golden/ui.test.ts`: the `filterRows` runner compares `checkForms` (absent in
  `out` means false), as `UiGoldenTest.kt` already does after build-2. The case
  "a word with a two-word form is marked Check forms" is in `golden/ui.json`.

## Tests

- `web/test/ui/add/`: a form "most curious" on "curious" shows the message and Save stays
  enabled; the paste dialog lists the warning for a valid two-word-form answer.
- `web/test/ui/words/`: a row with `checkForms` shows "Check forms"; one without doesn't.
- The golden `filterRows` case passes on the TypeScript runner.

Done: `cd web && npm test && npm run typecheck`.
