# Form warnings

Flag a pasted form that is probably not a real form of the word, so the user can fix it
before it reaches review. Asked for by Alan on 20/10/2026: a chat AI gave "curious" the
form "most curious", labelled "superlative". The reply was valid JSON in the right shape,
so `parsePastedLookup` accepted it, and review later asked for a spelling with a space in
it. This is the design doc for the Jogging piece `form-warnings`.

## The rule

One pure function per app, `formWarnings(word, content)` in `domain/` (Kotlin) and
`web/src/domain/` (TypeScript), golden-tested in a new `golden/warnings.json`:

- A form whose spelling contains whitespace, when the root word's own spelling has none,
  is flagged: "“most curious” is more than one word. Spelling review asks for one word."
- A root that is itself a phrase ("ice cream") flags nothing for its spaced forms
  ("ice creams").
- Hyphens and apostrophes are not spaces ("mother-in-law", "don't" pass).
- The result names each flagged form (definition and form index) and its message, in
  content order, and is empty for a clean word.

Warnings never reject. The paste stays valid, and a deliberate phrase can still be saved.
The rule is the first of a kind; later checks (a label like "superlative" on a two-word
form, a form identical to another) can join it in the same function.

## Where it shows

- **After a paste** (add and edit screens): below the paste summary, a warning line per
  flagged form, and the flagged form's field marked in the form editor so it can be
  fixed or removed before Save. Save is not blocked.
- **Word list:** a word with any warning shows a small "Check forms" marker on its row,
  computed from its saved content. Tapping the row opens the edit screen as now, with the
  same marks. This catches words already saved, like "curious".
- **Lookup prompt:** one line added to `lookupPrompt`'s forms rule: each form is a single
  word, so leave out forms made with another word, such as "more"/"most" comparisons. It
  prevents most cases; the warning catches the rest. `golden/prompt.json` is updated with
  it, on both apps.

## Decisions

- **No "keep anyway".** A dismissed warning would need storing, which means a schema
  change and a backup field. A deliberate spaced form on a one-word root is rare, so the
  marker simply stays until the form is fixed.
- **Computed, never stored.** No schema, migration or backup format change.
- **Search is unchanged.** It still matches spellings only; no filter for flagged words.

## Where it touches

- Android: `domain/` (the rule and its unit tests), `ui/add/AddWordScreen.kt` and
  `AddWordViewModel.kt` (warnings after paste, marks on fields),
  `ui/words/WordListScreen.kt` and `WordListViewModel.kt` (the marker),
  `domain/LookupPrompt.kt`, `ui/TestTags.kt` and `e2e/support/testIds.ts`.
- Web: the mirrors in `web/src/domain/`, `web/src/ui/add/`, `web/src/ui/words/`,
  `web/src/ui/testIds.ts`.
- Golden: `golden/warnings.json` with runners on both apps, a row in
  `golden/README.md`, and `golden/prompt.json`.
- Specs: a scenario in `specs/copy_prompt.feature` (paste a reply with a two-word form, see
  the warning, fix it, save) and one in `specs/word_list.feature` (a saved word with a
  two-word form shows the marker).
- Docs: `CLAUDE.md` "Lookup" (warnings after a valid paste), `CHANGELOG.md` under
  `[Unreleased]`, `### Added`.

No dependency on other pieces. Release: `minor`.
