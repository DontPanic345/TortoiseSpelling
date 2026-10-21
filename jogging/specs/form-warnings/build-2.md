# form-warnings/build-2: Android: warnings on the add screen and the Check forms badge

Show `formWarnings` (built in build-1, `domain/FormWarnings.kt`) on the add/edit screen and
the word list. Warnings never block Save and are never stored.

Built already (build-1): `data class FormWarning(val definition: Int, val form: Int, val message: String)`
and `fun formWarnings(word: String, content: WordContent): List<FormWarning>`: forms
(never the base form) whose trimmed spelling has whitespace, on a root whose trimmed
spelling has none, in content order, each with the message
"“most curious” is more than one word. Spelling review asks for one word."

## Design

Paths under `app/src/main/java/io/github/dontpanic345/tortoisespelling/`.

- `ui/add/AddWordViewModel.kt`:
  - `PasteDraft` gains `val warnings: List<FormWarning> get()`: for a
    `PastedLookup.Valid` result, `formWarnings(result.word, result.content)`; otherwise
    empty.
  - `AddWordUiState` gains `val formWarnings: List<FormWarning> get() = formWarnings(text, content)`.
    Live, from what is on screen: a form typed by hand is marked too, fixing or removing it
    clears the mark at once, and a word opened from the word list shows its marks.
  - `canSave` and `applying` don't change.
- `ui/add/AddWordScreen.kt`:
  - `PasteDialog`: below the paste text field (whose supporting text is the summary) and
    before the "This answer is for…" and "Using it replaces…" lines, one `Text` per
    `paste.warnings` entry, `bodyMedium`, `color = MaterialTheme.colorScheme.error`.
  - `AddWordContent` passes `state.formWarnings` to `DefinitionEditor`, which passes each
    `FormEditor` `warning: String?`, the message of the warning with
    `definition == d && form == f`. The form text field: `isError = form.text.isBlank() ||
    warning != null`; supporting text "Required" when blank, else the warning when there is
    one, else none (as now).
- `ui/words/WordListViewModel.kt`: `WordRow` gains `val checkForms: Boolean = false`;
  `filterRows` sets it to `formWarnings(content.word.text, content.toContent()).isNotEmpty()`.
- `ui/words/WordListScreen.kt`: when `row.checkForms`, a second badge beside `StatusBadge`
  (put both in a `Row` with `Arrangement.spacedBy(6.dp)`), the same `Surface` shape, padding
  and `labelSmall` text, in `colorScheme.errorContainer` / `onErrorContainer`, reading
  "Check forms", with `testTag(TestTags.wordRowCheckForms(row.word.normalizedText))` on the
  text (as `wordRowStatus`).
- `ui/TestTags.kt`: `fun wordRowCheckForms(normalizedText: String) = "word_row_check_forms_$normalizedText"`,
  mirrored in `e2e/support/testIds.ts` and in `web/src/ui/testIds.ts` as
  `export const wordRowCheckForms = (normalizedText: string) => \`word_row_check_forms_${normalizedText}\``.
  The web one lands here, not in build-3, because `web/test/ui/testIds.test.ts` reads
  `TestTags.kt` and fails CI when an Android tag has no web twin.
- `golden/ui.json`: a `filterRows` case "a word with a two-word form is marked Check forms":
  "curious" (one definition, forms "curious" and "most curious", each with an example
  containing it) beside "run" (with "ran"), query "", filter `ALL`; `out` rows gain an
  optional `checkForms`, absent meaning false, `true` for "curious". The Kotlin runner in
  `UiGoldenTest.kt` compares `checkForms` (default false). The TypeScript runner in
  `web/test/golden/ui.test.ts` compares `c.out` with `toEqual`, so an unknown `checkForms`
  key would fail it: until build-3, strip it from the expected rows there
  (`c.out.map(({ checkForms, ...row }: any) => row)`), with a comment that build-3 compares
  it. `cd web && npm test && npm run typecheck` must still pass.
- `CHANGELOG.md`, under `[Unreleased]`, `### Added` (create the heading if missing): one
  line, e.g. "**Form warnings.** A pasted form of more than one word, like “most curious”,
  is flagged before you save, and words already saved with one show **Check forms** in the
  word list." It lands here because this is the first user-visible change.

## Tests

- `AddWordContentTest` (component): a state with a form "most curious" on the word "curious"
  shows the message and Save stays enabled; a paste draft whose result is a valid answer
  with a two-word form shows the warning in the dialog.
- `WordListContentTest`: a row with `checkForms` shows "Check forms"; a row without doesn't.
- JVM, in `app/src/test/java/io/github/dontpanic345/tortoisespelling/ui/add/AddWordUiStateTest.kt`:
  `AddWordUiState.formWarnings` (a two-word form is flagged; fixing its text clears it) and
  `PasteDraft.warnings` (valid with a two-word form; invalid; null result).
- Screenshot references change only if a preview shows a flagged word. If one does:
  `updateDebugScreenshotTest`, look at it, commit.

Done: `./gradlew testDebugUnitTest lintDebug validateDebugScreenshotTest`, the `component`
instrumented layer, and `cd web && npm test && npm run typecheck`.
