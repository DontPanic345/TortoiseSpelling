# Piece: form-warnings

Flag a form that is probably not a real form of its word, so the user can fix it before
review asks for it. Source: `docs/form-warnings.md` (asked for by Alan on 20/10/2026, after a
chat AI gave "curious" the form "most curious", labelled "superlative": valid JSON, so
`parsePastedLookup` took it, and review later asked for a spelling with a space in it).

## What it delivers

- One pure rule on both apps, `formWarnings(word, content)`: a form whose spelling has
  whitespace in it, on a root whose own spelling has none, is flagged with "“most curious”
  is more than one word. Spelling review asks for one word."
- **After a paste** (add and edit screens): the paste dialog lists a warning line per
  flagged form below its summary, and once the answer is used, the flagged form's field in
  the editor is marked with the same message. Save is never blocked.
- **Word list:** a row whose saved content has any warning shows a small "Check forms"
  badge beside its status. Tapping the row opens the edit screen as now, where the same
  marks show. This catches words already saved, like "curious".

Goals it leans on:

- **4.** Content only: grading, SM-2 and the session rules are untouched. A flagged form is
  still saved and still reviewed if the user keeps it.
- **1.** Computed, never stored: no schema change, no migration, no backup format change.
- **3.** The lookup prompt is unchanged and nothing calls an AI; the warning is the safety
  net behind whatever the chat AI replies.
- **5.** Both apps in one piece, the rule golden-tested in `golden/warnings.json`, and
  shared Gherkin scenarios.
- **7.** One small function and a few lines of UI on each side.

### Decisions (from the design doc)

- Warnings never reject. A deliberate phrase can still be saved.
- No "keep anyway": a dismissal would need storing (a schema change and a backup field).
  The marker stays until the form is fixed.
- Search is unchanged: spellings only, and no filter for flagged words.
- The lookup prompt is unchanged.

### Choices made in this spec

- **The base form is never flagged.** Saving always sets it to the word
  (`preparedFor`), so in the editor its stored text may be stale or blank; the root's
  spelling is checked by "is the root a phrase", not as a form.
- **Whitespace is Kotlin's `Char.isWhitespace`**, after trimming the form with Kotlin's
  `trim()`, so a non-breaking space or a tab inside a form counts, and spaces around a
  form don't. The web uses the existing `KT_WHITESPACE` class in `web/src/domain/text.ts`.
  The root is a phrase when its trimmed spelling has any such character.
- **The marks are live.** The editor computes warnings from what is on screen every time,
  not only after a paste, so a form typed by hand is marked too, and fixing or removing it
  clears the mark straight away. That is also what makes the edit screen show the marks
  for a word opened from the list.
- **Index fields, not a tree.** A warning carries the definition and form index; the UI
  looks its own form up by `(d, f)`.

## Design

### The rule (pure, shared)

`app/src/main/java/.../domain/FormWarnings.kt`:

```kotlin
/** A form that probably isn't a real form of its word: where it is and what to tell the user. */
data class FormWarning(val definition: Int, val form: Int, val message: String)

/**
 * The suspect forms in [content], in content order (definition, then form); empty for a
 * clean word. The base form (definition 0, form 0) is never flagged: saving sets it to [word].
 */
fun formWarnings(word: String, content: WordContent): List<FormWarning>
```

`web/src/domain/formWarnings.ts`:

```ts
export interface FormWarning { definition: number; form: number; message: string }
export function formWarnings(word: string, content: WordContent): FormWarning[]
```

The rule, the only one for now:

- If `word.trim()` contains a whitespace character, return `[]`: a phrase root ("ice cream")
  may have spaced forms ("ice creams").
- Otherwise, for each form other than the base form, take `form.text.trim()`; if it
  contains a whitespace character, flag it with
  `“<trimmed text>” is more than one word. Spelling review asks for one word.`
  (curly quotes U+201C/U+201D, as every other message in the app).
- Hyphens and apostrophes are not whitespace ("mothers-in-law", "don't" pass). A blank form
  is not flagged (the editor already says "Required").

Whitespace is Kotlin's `Char.isWhitespace` (Kotlin: `any(Char::isWhitespace)`; web: a new
`ktHasWhitespace(raw)` in `web/src/domain/text.ts` testing `KT_WHITESPACE`, next to
`ktIsBlank`). Later checks (a label like "superlative" on a two-word form, a duplicate form)
join this function; the result shape doesn't change.

Golden: a new `golden/warnings.json`, `{ "about": …, "formWarnings": [ … ] }`, each case
`{ "name", "word", "content", "out": [ { "definition", "form", "message" } ] }` with content in
the shared `WordContent` shape (`golden/README.md`). Runners: `WarningsGoldenTest.kt` beside
the other golden tests, and `web/test/golden/warnings.test.ts`, each with the "has a runner
for every function" check. A row in `golden/README.md`'s file table:
`| warnings.json | formWarnings |`. Cases at least:

1. a clean word ("run" with "ran", "running") → `[]`
2. "curious" with "most curious" at definition 0, form 1 → one warning, `definition` 0,
   `form` 1, the message above
3. a phrase root "ice cream" with "ice creams" → `[]`
4. "mother-in-law" with "mothers-in-law" → `[]`
5. "do" with "don't" → `[]`
6. spaces around a form (" curiouser ") → `[]`
7. a non-breaking space inside a form (`"most curious"`) → flagged, the message holding
   the ` `
8. a tab inside a form → flagged
9. a root with a non-breaking space inside is a phrase → `[]`
10. a root with spaces around it (" curious ") is one word → its spaced form is flagged
11. two flagged forms in two definitions → both, in content order
12. a base form whose text has a space, word "curious" → `[]` (the base form is never checked)
13. a blank form → `[]`

### Android

- `ui/add/AddWordViewModel.kt`:
  - `PasteDraft` gains `val warnings: List<FormWarning> get()`: for a `Valid` result,
    `formWarnings(result.word, result.content)`, otherwise empty.
  - `AddWordUiState` gains `val formWarnings: List<FormWarning> get() = formWarnings(text, content)`.
  - `applying` and `canSave` don't change: warnings never block.
- `ui/add/AddWordScreen.kt`:
  - `PasteDialog`: below the paste text field (whose supporting text is the summary) and
    before the "This answer is for…" and "Using it replaces…" lines, one `Text` per
    `paste.warnings` entry, `bodyMedium`, in `colorScheme.error`.
  - `DefinitionEditor` and `FormEditor` take the warning for their form:
    `AddWordContent` passes `state.formWarnings`, and `FormEditor` gets
    `warning: String?` (the message whose `definition == d && form == f`). The form text
    field shows `isError = form.text.isBlank() || warning != null` and supporting text
    "Required" when blank, else the warning when there is one, else none.
- `ui/words/WordListViewModel.kt`: `WordRow` gains `val checkForms: Boolean = false`;
  `filterRows` sets it to `formWarnings(word.text, content.toContent()).isNotEmpty()`.
- `ui/words/WordListScreen.kt`: when `row.checkForms`, a second badge beside `StatusBadge`
  (put both in a `Row` with 6 dp spacing), the same shape and type, in `errorContainer` /
  `onErrorContainer`, reading "Check forms", tagged `TestTags.wordRowCheckForms(normalizedText)`.
- `ui/TestTags.kt`: `fun wordRowCheckForms(normalizedText: String) = "word_row_check_forms_$normalizedText"`,
  mirrored in `e2e/support/testIds.ts` and `web/src/ui/testIds.ts` in the same step
  (`web/test/ui/testIds.test.ts` fails when an Android tag has no web twin).
- Golden `ui.json`: a `filterRows` case "a word with a two-word form is marked Check forms"
  ("curious" with "most curious" next to "run" with "ran"); `out` rows gain an optional
  `checkForms` (absent means false), and both runners compare it.
- Tests: `AddWordContentTest` (a flagged form shows its message and Save stays enabled; the
  paste dialog lists the warning for a valid answer with a two-word form) and
  `WordListContentTest` (a row with `checkForms` shows "Check forms", one without doesn't).
  JVM unit tests for the two state properties in the existing `AddWordViewModel` tests.
  Screenshot references change only if a preview shows a flagged word; if one does, update,
  look, commit.

### Web

- `web/src/ui/add/AddWordContent.tsx`: the paste dialog, after `<p class="support">` with the
  summary, renders `<p class="warning">` per warning from `formWarnings(result.word,
  result.content)` when the result is valid. The form editor's `Field` for a non-base form
  gets `error={formMissing || warning !== null}` and `support={formMissing ? "Required" :
  warning}`, with the warnings computed once from `formWarnings(ktTrim(state.text),
  state.content)` and passed down by `(d, f)`. A `.warning` style in the CSS uses the
  error colour the `Field` error already uses.
- `web/src/ui/words/wordListState.ts`: `WordRow` gains `checkForms: boolean`, set by
  `filterRows` as Android's.
- `web/src/ui/words/WordListContent.tsx`: when `row.checkForms`, a
  `<span class="status-badge check-forms" data-testid={wordRowCheckForms(...)}>Check forms</span>`
  after the status badge, styled with the error container colours.
- `web/src/ui/testIds.ts`: `wordRowCheckForms` (added in build-2 with the Android tag).
- Tests: `web/test/ui/add/` and `web/test/ui/words/` mirror the Android component tests.

### e2e (shared)

`specs/support/fixtures.ts` gains a `curious` answer in `lookupAnswers`: one definition
("eager to know or learn something", adjective) with the forms "curious" ("A curious cat
looked in.") and "most curious" labelled "superlative" ("She is the most curious child in
the class.").

`specs/copy_prompt.feature`:

```gherkin
  Scenario: A pasted form of two words is flagged, and fixed before saving
    Given I have no words yet
    When I start adding the word "curious" without a definition
    And I paste the chat's answer for "curious"
    Then I see "“most curious” is more than one word. Spelling review asks for one word."
    When I use the answer
    Then the editor warns "“most curious” is more than one word. Spelling review asks for one word."
    When I remove the form "most curious"
    And I save the changes
    Then I am told "Added ✓ (1 total)"
    When I open the word list
    Then "curious" is not marked Check forms
```

`specs/word_list.feature` (its Background adds "rhythm" and "necessary" and opens the list):

```gherkin
  Scenario: A saved word with a two-word form is marked to check
    When I open "rhythm"
    And I add the form "rhythm section" labelled "compound" with the example "The rhythm section played on."
    And I save the changes
    Then "rhythm" is marked Check forms
    And "necessary" is not marked Check forms
    When I open "rhythm"
    Then the editor warns "“rhythm section” is more than one word. Spelling review asks for one word."
```

The paste dialog's warning is checked with the existing `I see`, since the dialog is on
screen. New steps, on both runners with the same text:

- `the editor warns {string}`: the text is shown in the add/edit screen. The tree editor is
  long and a flagged form sits below the fold, so Android scrolls the editor until the
  text is displayed (as `I choose` and `addWord.save` already scroll); the web asserts it
  visible (Playwright scrolls).
- `I remove the form {string}`: taps the button whose accessibility label is
  `Remove form “<form>”` (Android content-desc, scrolling to it first; web `aria-label`).
- `{string} is marked Check forms` and `{string} is not marked Check forms`: both wait for
  the word's row first, then check the `word_row_check_forms_<normalized>` id is displayed,
  or absent.

Everything else is an existing step. Each new Android step goes in
`e2e/step-definitions/` (screen helpers in `e2e/support/screens/addWord.ts` and
`wordList.ts`), each web one in `web/steps/`; both `check-steps` must pass.

### Docs

- `CLAUDE.md`, "Lookup": a sentence: after a valid paste, and in the editor and word list,
  `formWarnings` flags a spaced form on a one-word root; warnings never reject and are
  never stored.
- `CHANGELOG.md`: under `[Unreleased]`, `### Added`: a line on the warning after a paste
  and the "Check forms" badge in the word list.
- `README.md` and `PRIVACY.md`: no change (no new data, nothing leaves the device).

No schema, migration or backup change, so no `golden/backup/` case.

## Steps

1. **build-1**: the rule on both apps, `golden/warnings.json`, both runners.
2. **build-2**: Android: the add screen's marks and dialog warnings, the word list badge,
   the tag (and its web twin), the `ui.json` case and the Kotlin runner's `checkForms`,
   component tests.
3. **build-3**: Web: the same, the TypeScript `filterRows` and runner.
4. **build-4**: the fixture, both scenarios and their steps on both runners, docs and
   changelog.
5. **review**.

## What later pieces rely on

`formWarnings` is the one place for content checks: a new check adds a case to
`golden/warnings.json` and a branch to the function, and every screen that shows warnings
picks it up. `WordRow.checkForms` is true for any warning, not just this rule.
