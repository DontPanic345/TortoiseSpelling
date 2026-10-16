# 📋 Behaviour specs

Gherkin features for Tortoise Spelling, written once for both apps. The Android app runs
them through WebdriverIO, Cucumber and Appium (`e2e/`, see [its README](../e2e/README.md));
a scenario with no platform tag is one both apps must pass, and passing on both is the
evidence that they behave the same.

## Tags

| Tag | Meaning |
|---|---|
| `@e2e` | The layer. On every feature, at feature level, and the only layer tag |
| `@android` | Only Android can do this. Needs a `# Android only: …` comment on the line above |
| `@web` | Only the web app can do this. Needs a `# Web only: …` comment on the line above |
| `@todo` | Steps not implemented yet; excluded until they are |
| `@slow` | Waits minutes for something real, e.g. a scheduled reminder. Android only |
| `@release-smoke` | The release-build journey. Android only |

No platform tag means shared: a platform tag is allowed only where the platform forbids
the behaviour, never to make a failing scenario pass. `node scripts/check-specs.mjs`
checks the tags (CI's `scripts` job runs it); `scripts/check-specs.test.mjs` covers it.

## Running

- Android: `cd e2e && npm run e2e`, or one feature with
  `npm run e2e -- --spec ../specs/<name>.feature`.
- Both runners' `check-steps` must pass: a step is implemented in `e2e/step-definitions/`
  (and, once the web runner exists, in `web/steps/`).

## Support files

`support/fixtures.ts` holds the test data both runners use (the chat AI's answers and the
flat backup file). It is plain TypeScript with no imports and no globals.

## Writing scenarios

- **Keep this suite small.** It's the top of the testing pyramid: a handful of journeys
  through the real app, plus what only a device can show (permission prompts,
  notifications, the document picker, process death). Rules and edge cases belong in unit
  tests; a new scenario should be a new journey, and a new check on an existing journey is
  a step added to its scenario, not a scenario of its own.
- Write in the user's voice, about behaviour ("I am told…", "Home shows…"), not widgets.
- **Given** arranges and waits until it is true; **When** acts and does not assert; **Then**
  asserts. `I have added the word …` (Given) seeds the word directly; `I add the word …` (When)
  types it into the Add screen and leaves the outcome to the Then steps.
- Reuse existing steps before adding new ones: `npm run check-steps -- --all` (in `e2e/`)
  prints a snippet for anything undefined.
- Keep scenarios independent; never rely on another scenario's leftovers.
