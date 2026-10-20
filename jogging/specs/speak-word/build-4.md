# speak-word/build-4: the scenario, docs and changelog

The scenario and its steps on both platforms, and everything under "Docs" below. The
Android and web buttons, test ids and fakes are already built (build-2, build-3).

## Design

### e2e (shared)

One scenario in `specs/review.feature`:

```gherkin
  Scenario: Hearing the word
    Given I have added the word "necessary" defined as "needed or required"
    And I go back to Home
    When I start today's session
    And I tap Hear the word
    Then "necessary" was spoken
```

The Given, And and first When are existing steps. A plain word, because there is no
seed step for a word whose card would deterministically ask for a different form (the
card pick breaks ties at random); speaking `card.form` rather than the root is proven by
the component tests. Only the two new steps are added. Android, in
`e2e/step-definitions/review.steps.ts`: the tap step clears the log first
(`mobile: shell` `logcat -c`, allowed already by `uiautomator2:adb_shell`) and taps the
`review_speak` resource-id; the Then step polls `mobile: shell`
`logcat -d -s TortoiseSpeech:I` for `spoke "necessary"`. Web, in `web/steps/`: click the
test id; poll `window.__tortoiseSpellingSpoken`. Mirror the tag in
`e2e/support/testIds.ts`.

### Docs

- `README.md`: a line under "How it works" (🔊 tap to hear the word, spoken by the
  phone's or browser's own voice).
- `PRIVACY.md`: speech is synthesised on the device; the apps never use a network voice.
- `CLAUDE.md`: under "Review screen details", the speaker: on-device voices only, hidden
  when none, the debug `RecordingSpeaker`, the manifest `<queries>` entry, and the web
  button's `preventDefault` on `pointerdown`.
- `CHANGELOG.md`: one line under `[Unreleased]` (Added).
