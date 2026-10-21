# form-warnings/build-4: the shared scenarios, docs and changelog

Two Gherkin scenarios proving the form warnings on both apps, their new steps on both
runners, and the docs. Built already: `formWarnings` (build-1), Android's add-screen marks,
paste-dialog warnings and "Check forms" badge with tag
`word_row_check_forms_<normalizedText>` (build-2), and the web's (build-3, `data-testid`).

The message, everywhere: "“<form>” is more than one word. Spelling review asks for one word."
The paste dialog shows it below the summary; the add/edit editor shows it as the flagged
form field's supporting text; the word list shows a "Check forms" badge on the row.

## Fixture

`specs/support/fixtures.ts`: a `curious` entry in `lookupAnswers`, single-line JSON like the
others: one definition "eager to know or learn something", part of speech "adjective",
forms "curious" (label "base", example "A curious cat looked in.") and "most curious"
(label "superlative", example "She is the most curious child in the class.").

## Scenarios

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

No platform tags: both apps must pass both.

## New steps (both runners, same text, same assertion)

Android in `e2e/step-definitions/` (helpers in `e2e/support/screens/addWord.ts` and
`wordList.ts`), web in `web/steps/` (helpers in `web/steps/support/screens/`):

- `the editor warns {string}`: the text is displayed on the add/edit screen. The tree
  editor is long and a flagged form sits below the fold, so Android scrolls until the text
  is displayed (as `I choose` and `addWord.save` already do); the web asserts it visible.
- `I remove the form {string}`: taps the button labelled `Remove form “<form>”` (Android
  content-desc, scrolled to first; web `aria-label`).
- `{string} is marked Check forms` / `{string} is not marked Check forms`: wait for the
  word's row (`word_row_<normalized>`) first, then check `word_row_check_forms_<normalized>`
  is displayed, or absent.

If `e2e/support/testIds.ts` lacks `wordRowCheckForms`, add it (build-2 should have).

## Docs

- `CLAUDE.md`, "Lookup": one sentence: after a valid paste, and in the editor and the word
  list, `formWarnings` (`domain/FormWarnings.kt`, golden `warnings.json`) flags a spaced
  form on a one-word root; warnings never reject and are never stored.
- `CHANGELOG.md`: build-2 added the line under `[Unreleased]`, `### Added` ("**Form
  warnings.** …"). Check it is there and still true; don't add a second one.

Done: `node scripts/check-specs.mjs`; `cd e2e && npm run check-steps -- --all && npm run typecheck`;
`cd web && npm run check-steps && npm run specs`; on the emulator,
`cd e2e && npm run e2e -- --spec ../specs/copy_prompt.feature` and `--spec ../specs/word_list.feature`.
CI runs both suites on push.
