# edit-after-miss/build-4: the shared scenario, docs and changelog

Add the shared scenario for Edit word to `specs/review.feature`, run it on both apps, and
write the docs and the changelog line. The feature itself is built on both apps (build-2
Android, build-3 web): after a miss in review, an **Edit word** button opens the edit
screen; saving undoes the miss (scheduling back to before, the log row gone, in one
transaction) and asks the word again as a fresh card; back keeps the miss; delete drops
the word from the session.

## The scenario

Append to `specs/review.feature`, after "Showing the answer demands a clean retype". No
platform tag: both apps must pass it.

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

Every step exists in `e2e/step-definitions/` and `web/steps/`; add none. If one doesn't
work here (for example `I choose` finding the top bar's "Edit word" title instead of the
button), fix the step in both runners so they keep the same text and assertion, rather
than tagging the scenario. A new word's miss and first-try success both come back
tomorrow, so the scenario can't show the grade; the integration and web journey tests
assert it.

Run it on both apps:

```bash
cd e2e && npm run e2e -- --spec ../specs/review.feature
cd web && npm run specs -- --project=specs-chromium review
```

and both `check-steps` (`cd e2e && npm run check-steps -- --all`, `cd web && npm run check-steps`)
and `node scripts/check-specs.mjs`.

## Docs

- `CLAUDE.md`, "Scheduling": after "abandoning mid-correction still counts as a lapse",
  add "unless the user saves an edit from review's **Edit word**: `undoReview` puts back the
  scheduling captured before the miss and deletes its log row, in one transaction, and the
  word is asked again." Keep the rest of the paragraph; keep it short.
- `README.md`, the "Immediate correction" bullet: add "If the word itself was wrong, Edit
  word fixes it and the miss doesn't count."
- `CHANGELOG.md`, `[Unreleased]`, `### Added` (create the heading if it isn't there):
  "**Edit word** after a miss in review, on Android and the web: fix a wrong definition,
  form or example, and saving takes the miss back and asks the word again."
- `PRIVACY.md`: no change.
- `jogging/GOALS.md` already records the goal 4 exception (the spec step added it).

## Acceptance

```bash
node scripts/check-specs.mjs
grep -q "Fixing a wrong entry after a miss asks the word again" specs/review.feature
grep -q "Edit word" CHANGELOG.md
grep -q "undoReview" CLAUDE.md
```
