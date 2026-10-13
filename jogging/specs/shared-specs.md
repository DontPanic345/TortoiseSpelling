# Piece: shared-specs

The Gherkin features move out of `e2e/features/` into a root `specs/` folder, every
feature gets a layer tag and, where only one platform can run it, a platform tag, and
the shared scenarios run against the web app through Playwright as well as against the
APK through Appium. Source: `docs/testing-and-web-plan.md` ("Gherkin", the "Shared
specs" bullet, and "Suggested order" step 4).

Builds on `web-ui` as specified, and through it on every earlier piece. This spec
assumes:

- `e2e/features/` as the earlier pieces leave it: `add_word`, `backup`, `completion`,
  `copy_prompt` (`copy-prompt`), `daily_allowance`, `notifications`, `release_smoke`
  (`@release-smoke`, `test-ui-layers`), `review`, `settings` (the Google backup switch
  only), `word_forms` (`word-forms`) and `word_list`. `claude_lookup.feature` and
  `@live-api` are gone (`drop-api-key`).
- `e2e/support/lookupAnswers.ts` (`copy-prompt`), `e2e/support/screens/backup.ts` with
  its `buildBackupJson`, and `DEFAULT_TAGS = 'not @todo and not @slow and not
  @release-smoke'` in `e2e/support/config.ts`.
- `web/` with Preact screens whose copy is Android's and whose `data-testid`s are the
  `TestTags.kt` values (`web/src/ui/testIds.ts`); `<App container>`; `main.tsx`
  building the container; `@playwright/test` with `playwright.config.ts`, the
  console-error fixture and the `smoke/` suite in Chromium and WebKit; `web.yml` called
  by `ci.yml` and `pages.yml`; web-core's `simpleContent` and `addWord`.

## What it delivers

- **One set of behaviour specs for two apps**, in `specs/*.feature`. A scenario with no
  platform tag runs on both, and passing on both is the evidence that the apps behave
  the same.
- **Tags that say where a scenario runs**: `@e2e` on every feature (its layer), and
  `@android` or `@web` on what only one platform can do, each with a comment saying why.
  A script checks the tags in CI.
- **The Android runner unchanged in kind**: WebdriverIO, Cucumber and Appium, reading
  `../specs/` and skipping `@web`.
- **A web runner**: `playwright-bdd` turns the same features into Playwright tests,
  run in Chromium and WebKit against a test build of the web app that exposes a seed
  hook (the web's `SeedWordsActivity`), with web step definitions in `web/steps/`.
- **CI runs the shared scenarios on the web** on every push, inside `web.yml`, so a
  Pages deploy and an Android release both wait for them. Android's scenarios still
  need a device and stay out of CI, apart from the release smoke run.

No scenario is added or removed: the suite stays the top of the pyramid. Nothing in the
Android app changes unless a shared scenario exposes an Android bug (see "Parity
failures").

Goals it leans on:

1. **Nothing lost.** `backup.feature` runs on both platforms against the same flat
   (pre-tree) backup file, so an old Android file importing on the web is proved by
   behaviour as well as by web-core's golden cases.
2. **Reminder.** `notifications.feature` stays Android-only until `web-push`, which adds
   the web's reminder scenarios. Nothing about Android's reminder changes.
5. **Two apps that behave the same.** The main payoff. A platform tag is allowed only
   where the platform forbids the behaviour, and it carries its reason.
6. **Free to run.** Playwright on GitHub's free runners; no device farm.
7. **Simple.** One new dev dependency (`playwright-bdd`), no new runtime code in the
   production web build, no change to the Android runner's stack.

### Settled here (the docs and decisions leave these open)

- **Platform tags mark the exception.** No platform tag means shared. `@android` and
  `@web` mark scenarios one platform can't run, at feature or scenario level. A tag
  line holding either has a `# Android only: …` or `# Web only: …` comment on the line
  above it.
- **Every feature carries `@e2e` at feature level, and it is the only layer tag.** The
  doc names `@component` too, but the component and lower layers are written in their
  own frameworks (Compose UI tests, JUnit, Vitest), as the doc's own Gherkin section
  says for rules and algorithms, and no Gherkin runner exists for them. A new layer tag
  is added together with a runner that selects it. Both runners select `@e2e`, so the
  tag is load-bearing, and the tag check makes sure no feature lacks it (a feature
  without it would silently run nowhere).
- **`@slow` and `@release-smoke` are Android-only** and must sit with `@android`: one
  waits for a real reminder, the other exercises R8. The web runner then needs only
  `@e2e and not @android and not @todo`.
- **The tag check is a root script**, `scripts/check-specs.mjs`, tested like the
  release scripts (`node --test 'scripts/*.test.mjs'`) and run in CI's `scripts` job.
  It parses tag lines itself rather than adding a Gherkin parser to the repo root.
- **`playwright-bdd`, not Cucumber driving Playwright.** It generates Playwright tests
  from the features, so the web runner keeps `@playwright/test`'s projects, parallel
  workers, fixtures (the console-error fixture included), traces and reports, which a
  Cucumber World would have to rebuild by hand. The Android runner keeps Cucumber
  (the doc's decision: the runner is an implementation detail). Both read Cucumber
  expressions, so step text is written once in the feature and implemented once per
  platform.
- **The web runs against a test build, `vite build --mode e2e`**, in `web/dist-e2e/`.
  It is the production build plus one seed hook, as the debug APK is the release APK
  plus `SeedWordsActivity`: same CSP, same service worker, same container. The hook is
  installed under `import.meta.env.MODE === "e2e"`, which Vite replaces at build time,
  so the production bundle doesn't contain it, and a check proves that.
- **No test clock on the web.** The Android run uses the device's real clock and real
  fuzz, and no shared scenario depends on either (the only interval reached is 1 day,
  which isn't fuzzed). The web run does the same, so both apps run the scenarios under
  the same conditions.
- **The web steps drive the app's own navigation.** Android's "go back" is the system
  Back button; the web has no system Back in an installed iPhone app, so the web step
  taps the app's Back or End session button. That also tests the web's navigation.
- **Phone-sized pages, no touch.** Both web projects use the desktop device descriptors
  (Desktop Chrome, Desktop Safari) with a 412×915 viewport, the emulator's size in dp.
  Touch emulation would make export take the share-sheet path, which Playwright can't
  complete.
- **Fixtures both runners use live in `specs/support/fixtures.ts`**: the chat answers
  for `copy_prompt.feature` (moved from `e2e/support/lookupAnswers.ts`) and the flat
  backup file `backup.feature` imports (moved out of `screens/backup.ts`). It is plain
  TypeScript with no imports and no globals, included by both tsconfigs, so the two
  platforms can't drift apart on test data.

## Design

### Layout

```text
specs/
  README.md                 what the folder is, the tags, how each platform runs it
  *.feature                 moved from e2e/features/ with git mv
  support/fixtures.ts       lookupAnswers, flatBackupFile
scripts/
  check-specs.mjs           the tag check: pure checkFeature + a main over specs/
  check-specs.test.mjs
e2e/                        the Android runner, reading ../specs
web/
  playwright.specs.config.ts
  scripts/check-steps.mjs   bddgen plus the unused-step check
  src/debug/seedHook.ts     installSeedHook(container), e2e builds only
  steps/
    *.steps.ts              common, home, review, settings, words, backup, copy_prompt
    support/                fixtures.ts (test, Given/When/Then/Before), selectors.ts,
                            seed.ts, scenario.ts, screens/*.ts
```

The `e2e/` and `web/steps/` file names mirror each other, so a step's two
implementations are easy to find side by side.

### Tags

| Feature | Tags | Comment above a platform tag |
|---|---|---|
| `add_word` | `@e2e` | |
| `backup` | `@e2e` | |
| `completion` | `@e2e` | |
| `copy_prompt` | `@e2e` | |
| `daily_allowance` | `@e2e` | |
| `notifications` | `@e2e @android` | `# Android only until web-push: the permission prompt, notifications, rotation and process death are the system's.` |
| `release_smoke` | `@e2e @android @release-smoke` | `# Android only: it exercises the R8-minified release APK.` |
| `review` | `@e2e` | |
| `settings` | `@e2e @android` | `# Android only: Google backup has no web equivalent.` |
| `word_forms` | `@e2e` | |
| `word_list` | `@e2e` | |

Feature-level tags go on the line(s) before `Feature:`. If a feature differs from the
list above when this piece is built (an earlier build renamed or merged one), apply the
same rule: shared unless the platform forbids it.

`backup.feature`'s opening comment becomes: "On Android, files go through the document
picker in the device's Downloads folder. On the web, export is a download and import
picks a file, both in a Downloads folder the test run owns."

**`scripts/check-specs.mjs`** exports `checkFeature(name, source)`, returning a list of
problems (strings naming the file and line), and runs over `specs/*.feature` when
executed, printing every problem and exiting 1 if there are any, or printing "✓ N
features, tags OK." It reads lines, not a Gherkin AST:

- tag lines (trimmed, starting with `@`) before `Feature:` belong to the feature;
  those before `Scenario:` belong to that scenario, which also inherits the feature's;
- `Rule:`, `Scenario Outline:`, `Scenario Template:` and `Examples:` are reported as
  unsupported, so the parse can't silently misread a construct the suite doesn't use
  (`Background:`, data tables, doc strings and comments are fine);
- known tags: `@e2e`, `@android`, `@web`, `@todo`, `@slow`, `@release-smoke`; any other
  is a problem (it catches `@andriod`);
- the feature has exactly one layer tag (`@e2e`), and no scenario has one of its own;
- no scenario ends up with both `@android` and `@web`;
- `@slow` and `@release-smoke` only on scenarios that end up `@android`;
- the line before any tag line holding `@android` or `@web` is a `#` comment.

`check-specs.test.mjs` (`node:test`): a valid shared feature and a valid Android-only
feature pass; each rule above has a failing case (no layer tag, two `@e2e`, a scenario
`@e2e`, `@andriod`, `@android` feature with a `@web` scenario, a bare `@android`, `@slow`
without `@android`, a `Rule:`); and the real `specs/` folder passes.

### The Android runner (`e2e/`)

- `support/config.ts`: a new `ANDROID_TAGS = '@e2e and not @web'`, and `DEFAULT_TAGS`
  becomes `ANDROID_TAGS` followed by ` and not @todo and not @slow and not
  @release-smoke`, keeping whatever else it held. The KDoc says what `@e2e` and `@web`
  mean here.
- `wdio.conf.ts`: `specs: [['../specs/**/*.feature']]`.
- `scripts/checkSteps.ts`: `paths: ['../specs']`; `--all` selects `ANDROID_TAGS`
  instead of nothing (every scenario this platform runs, `@todo` included, with the
  unused-step check as now). The header comment says so.
- `e2e:slow` and `e2e:release` stay as they are: the tag check guarantees both tags are
  Android-only.
- `support/screens/backup.ts`: `pushWords` writes `flatBackupFile(words)` from
  `specs/support/fixtures.ts`; `buildBackupJson` goes. The copy-prompt steps import
  `lookupAnswers` from there; `support/lookupAnswers.ts` goes.
- `tsconfig.json`: `include` gains `"../specs/support/**/*.ts"`.
- A single feature runs with `npm run e2e -- --spec ../specs/<name>.feature`.

### The web runner (`web/`)

**Dependency.** `playwright-bdd`, current stable, pinned with `~` like the rest, whose
peer range includes the installed `@playwright/test`. Nothing else.

**Seed hook (`src/debug/seedHook.ts`).**

```ts
export interface SeedWord { word: string; definition?: string; example?: string; partOfSpeech?: string }
export function installSeedHook(container: AppContainer): void
```

It sets `window.__tortoiseSpellingSeed = async (words: SeedWord[]) => …`, which adds
each word through `container.repository.addWord(word, simpleContent(word, definition ??
"", partOfSpeech ?? null, example ?? ""))` (argument order as web-core's port of
`simpleContent`), in order, and throws if a result isn't `"added"`, so a Given that
can't arrange fails at once. The repository tells subscribers, so the screen underneath
refreshes, as Android's does when `SeedWordsActivity` finishes. The module has no
top-level side effects and declares the `Window` property. `main.tsx`, after building
the container: `if (import.meta.env.MODE === "e2e") installSeedHook(container);`.

**Scripts (`package.json`).**

- `build:e2e`: `vite build --mode e2e --outDir dist-e2e`
- `preview:e2e`: `vite preview --outDir dist-e2e --port 4174 --strictPort`
- `check-steps`: `node scripts/check-steps.mjs`
- `specs`: `bddgen -c playwright.specs.config.ts && playwright test -c playwright.specs.config.ts`

No environment variables in scripts: they must run from PowerShell too. `dist-e2e/` and
`.features-gen/` join the web project's `.gitignore`, wherever `web-ui` put `dist/`.

**`playwright.specs.config.ts`.**

- `testDir` from `defineBddConfig({ features: "../specs/*.feature", steps:
  "steps/**/*.ts", tags: "@e2e and not @android and not @todo" })`. Build-2 lists only
  the features it covers in `features`; build-3 widens it to the glob.
- `webServer`: `npm run build:e2e && npm run preview:e2e`, `url`
  `http://localhost:4174/`, `reuseExistingServer: !process.env.CI`.
- `use`: `baseURL` `http://localhost:4174/`, `trace: "retain-on-failure"`,
  `screenshot: "only-on-failure"`.
- Projects `specs-chromium` and `specs-webkit`: `devices["Desktop Chrome"]` and
  `devices["Desktop Safari"]`, each with `viewport: { width: 412, height: 915 }`.
- `fullyParallel: true`, `retries: 0` (a flaky scenario should show), `expect.timeout`
  10 s (WebdriverIO's `waitforTimeout`), test timeout 60 s. Reports go to the same
  `playwright-report/` and `test-results/` that `web.yml` uploads on failure.
- No `bypassCSP`: the scenarios run under the production policy. `page.evaluate`
  isn't subject to the page's CSP, so the seed call works without it.

There is no `SMOKE_URL` mode: the deployed site has no seed hook.

**`steps/support/fixtures.ts`.** `test` extends web-ui's console-error fixture (import it
from where build-6 put it; if it lives inside `smoke/`, move it to `web/playwright/` so
both suites import it) with:

- `scenario`: scenario-scoped memory, as `e2e/support/scenarioState.ts` (the words added
  so far, for `practiceAllCorrectly`), fresh per test.
- `downloads`: `testInfo.outputPath("downloads")`, created empty per test.

It exports `{ Given, When, Then, Before } = createBdd(test)`. `Before`: `page.goto("./")`,
then wait until Home's title or "No words yet" shows. Each test has a fresh browser
context, so storage starts empty, as `resetApp()` wipes the APK's data.

**`steps/support/selectors.ts`**, mirroring `e2e/support/selectors.ts`:

- `byText(page, text)`: `page.getByText(text, { exact: true }).filter({ visible: true
  }).first()`, the first visible element whose whole text is `text`, as UiSelector's
  `text()` is. Absence is `expect(page.getByText(text, { exact: true }).filter({
  visible: true })).toHaveCount(0)`.
- `byTestId(page, id)`: `page.getByTestId(id)`, ids from `src/ui/testIds.ts`.
- `byLabelIn(page, id, label)`: `byTestId(page, id).getByLabel(label, { exact: true
  })`, for `byTestIdWithDescendantDescription` (the week's dots, the progress bar, a
  row's Suspend and Delete buttons).
- `choice(page, label)`: the first visible button, menu item or link whose accessible
  name is exactly `label` (what "I choose" taps).

Fields are read with `inputValue()` and written with `fill()`, which replaces the value
and needs none of `typeInto`'s waits.

**Step implementations.** Every step a shared scenario uses gets a web twin with the
same text and the same assertion. Most are direct translations (same ids, same text).
The ones that differ by platform:

| Step | Android | Web |
|---|---|---|
| `I go back to Home` | System Back until Home's title shows | Up to 5 times: if Home's title "Tortoise Spelling" shows, stop; press Escape if a `dialog[open]` exists; else click the visible button named "Back" or "End session" |
| `I am on Home` | Home's title, scoped to the app | Home's top bar title "Tortoise Spelling" |
| `I have added the word …` (and the table and example forms) | `SeedWordsActivity` | `seedWords(page, words)`: waits for `window.__tortoiseSpellingSeed`, then `page.evaluate` calls it |
| `I open Settings` | Opens via More, waits for the reminder switch | Opens via More, waits for `settings_new_words_value` |
| `Downloads has no Tortoise Spelling test files` | Deletes the test files, then a media scan | Ensures the `downloads` fixture folder is empty |
| `I export a backup to Downloads as {string}` | Document picker | Waits for the `download` event while clicking Export, then `download.saveAs(downloads/name)` |
| `Downloads has a backup {string} containing {string} and {string}` | `pushFile` of `flatBackupFile` | Writes `flatBackupFile` to `downloads/name` |
| `I import {string} from Downloads` | Document picker | Waits for the `filechooser` event while clicking Import, then `setFiles(downloads/name)` |
| `I copy the lookup prompt` | Clicks Copy prompt | Clicks Copy prompt (the context grants `clipboard-read` and `clipboard-write` in Chromium) |
| `the clipboard holds the lookup prompt for {string}` | `getClipboard` | `navigator.clipboard.readText()` through `page.evaluate`, containing `I'm learning to spell "<word>".` If WebKit can't read the clipboard under Playwright, then in WebKit only the step checks "Prompt copied." (the app's message that `writeText` succeeded) and its comment says why. If `copy-prompt` dropped this step on Android, there's nothing to port. |
| `I paste the chat's answer for {string}` | `typeInto` the answer field | Clicks Paste answer, `fill`s `add_word_paste_text` with `lookupAnswers[word]` |
| `I have practised today's words correctly` | `practiceAllCorrectly`, finding the word by its definition in the page source | The same, reading `page.content()` |

Where the web's DOM groups text differently from Compose (a count and its caption in
one element, say), the web step may match differently, but it asserts the same thing,
and its comment says how it differs.

**`scripts/check-steps.mjs`** (the web's `npm run check-steps`): runs `bddgen -c
playwright.specs.config.ts`, which fails on a step that no definition matches, then
`bddgen export -c playwright.specs.config.ts --unused-steps` and exits 1 if that lists
any step. If the installed `playwright-bdd` has no `--unused-steps`, the script does
only the first part, and the log says so. It runs without browsers, in a few seconds.

### Parity failures

A shared scenario that fails on one platform is a parity bug, not a reason to tag it.
The step that finds it fixes the side that departs from Android's behaviour or copy
(normally the web), with a test at the lowest layer that shows it, and records it in
the log. A platform tag is right only when the platform forbids the behaviour (goal 5),
with its comment. If the Android app turns out to be the side that's wrong, the fix gets
a `CHANGELOG.md` line, the Android checks and the e2e features covering it, and the
piece's review then bumps the patch version.

### CI

- `ci.yml`, `scripts` job: a step "Shared specs are tagged" running `node
  scripts/check-specs.mjs` before the e2e checks. `check-steps -- --all` and
  `typecheck` there now read `../specs`. The header comment mentions the web run.
- `web.yml`, after the smoke suite: `npm run check-steps`, then `npm run specs` (the
  browsers are already installed). The job name stays "Web checks". Since `ci.yml` and
  `pages.yml` both call it, a deploy and a release both wait for the shared scenarios.
- `pages.yml` keeps its path filter: a change under `specs/` alone runs through `ci.yml`
  and needs no deploy.
- Dependabot's `/web` entry covers `playwright-bdd`.

### Docs

- **`specs/README.md`** (new, short like `e2e/README.md`'s opening): the folder holds
  the behaviour specs for both apps; the tag table (`@e2e`, `@android`, `@web`, `@todo`,
  `@slow`, `@release-smoke`); "shared unless the platform forbids it, with a comment";
  how to run them (`cd e2e && npm run e2e`, `cd web && npm run specs`, one feature on
  each); that a step is implemented in `e2e/step-definitions/` and in `web/steps/`, and
  both `check-steps` must pass; `node scripts/check-specs.mjs`. The "Writing scenarios"
  rules move here from `e2e/README.md` (user's voice, Given/When/Then, keep the suite
  small), since they now govern both apps.
- **`e2e/README.md`**: the opening points at `../specs/`; the commands use
  `../specs/<name>.feature`; the tag table becomes a pointer to `specs/README.md` plus
  the Android-only tags' meanings; "How it's put together" replaces the `features/` row;
  "Writing scenarios" becomes a pointer to `specs/README.md`, keeping only the
  Android-specific advice. "Why not Playwright" stays and adds that the web app's run of
  the same specs does use it.
- **`web/README.md`**: a "Shared specs" section: `npm run specs`, `npm run
  check-steps`, the test build and its seed hook, and the step layout.
- **`CLAUDE.md`**:
  - Commands: `--spec ../specs/<name>.feature`; `node scripts/check-specs.mjs`; `cd web
    && npm run specs` and `npm run check-steps`.
  - The layers table's "End-to-end BDD tests" row becomes "Shared BDD specs |
    `specs/`, run by `e2e/` and `web/steps/` | The real APK on a device; the web app's
    test build in Chromium and WebKit".
  - The CI bullet: the tag check, and the web run of the shared specs inside
    `web.yml`.
  - The E2E bullet: features live in `specs/`, shared unless tagged, and a change to a
    shared feature must pass on both platforms. Given steps seed through
    `SeedWordsActivity` on Android and `window.__tortoiseSpellingSeed` in the web's
    `--mode e2e` build.
- **`docs/testing-and-web-plan.md`**: the status line says the specs are shared; the
  "Shared specs" bullet describes what was built (the tags, the two runners, the
  `@component` decision above); "Suggested order" step 4 is marked done.
- **`CHANGELOG.md`**, **`README.md`**, **`PRIVACY.md`**: no change. Nothing a user sees
  changes, and the piece doesn't bump the version (unless a parity fix changes Android).

## Build steps

Each step follows `CLAUDE.md`'s Workflow and `PROTOCOL.md`. "Passing" means every
command exits 0. e2e goes to the phone `ANDROID_SERIAL` names in the cloud (rerun `bash
jogging/cloud-setup.sh` if `adb devices` doesn't list it). Abbreviations:

- `<e2e F…>`: `cd e2e && npm run e2e -- --spec ../specs/F.feature …`, one `--spec` per
  file.
- `<web>`: `cd web && npm ci && npm run typecheck && npm test && npm run build && npm
  run build:e2e`
- `<browsers>`: `cd web && npx playwright install --with-deps chromium webkit`. In the
  cloud, if WebKit's system dependencies won't install, install Chromium only, run with
  `--project=specs-chromium`, say so in the log, and rely on the CI run for WebKit.
- `<ci>`: push, then `gh run list --commit $(git rev-parse HEAD)` and `gh run watch` on
  each run until it's green.

### build-1: move the features, tag them, point the Android runner at them (Sonnet, medium)

"Layout" for `specs/` and `scripts/`, "Tags" with the check and its tests, "The Android
runner", the CI `scripts` step, `specs/README.md` (without the web commands, which
build-3 adds), `e2e/README.md`, and `CLAUDE.md`'s Commands and E2E bullet for the
Android side.

Before moving anything, run `cd e2e && npm run check-steps` and note its scenario count.

Acceptance:

```bash
git log --follow --oneline -1 specs/review.feature    # history followed the move
node --test 'scripts/*.test.mjs'
node scripts/check-specs.mjs                          # ✓ 11 features, tags OK (or however many exist)
cd e2e && npm ci && npm run check-steps && npm run check-steps -- --all && npm run typecheck
<e2e add_word backup copy_prompt settings>            # paths, both fixtures, an @android feature
```

- `npm run check-steps` reports the same scenario count as before the move.
- `ls e2e/features e2e/support/lookupAnswers.ts` fails (both gone).
- Temporarily delete `@e2e` from `specs/review.feature`, then temporarily change
  `settings.feature`'s `@android` to `@andriod`: `check-specs.mjs` fails each time and
  names the file. Revert both.
- `<ci>`.

### build-2: the web runner, the seed hook, and the first shared features (Sonnet, high)

The dependency, the seed hook and its `main.tsx` call, the scripts,
`playwright.specs.config.ts` with `features` listing `add_word`, `review`, `completion`
and `daily_allowance`, `steps/support/`, and the web steps those four features use. Fix
any parity failure they expose ("Parity failures"). High effort: it sets the web step
conventions build-3 follows, and it is where the two apps first meet scenario by
scenario.

Tests: `web/test/debug/seedHook.test.ts` (jsdom, real repository on `fake-indexeddb`):
the hook adds two words with their definitions and example; a duplicate throws.

Acceptance:

```bash
<web>
! grep -rq __tortoiseSpellingSeed web/dist          # not in the production build
grep -rq __tortoiseSpellingSeed web/dist-e2e          # in the test build
<browsers>
cd web && npm run check-steps && npm run specs        # every selected scenario passes in both projects
cd web && npm run smoke                               # the production build is unchanged
```

- Temporarily change the web Home's caption "word to practise today": `add_word`
  fails in both projects. Temporarily make the seed hook call `console.error`: every
  scenario that seeds fails on the console-error fixture. Revert both.
- Temporarily drop `@android` (and its comment) from `settings.feature` and add it to
  `features`: `npm run check-steps` fails on its undefined steps. Revert.
- `<ci>`.

### build-3: the remaining shared features, CI and the docs (Sonnet, high)

The web steps for `word_list`, `word_forms`, `copy_prompt` and `backup`;
`playwright.specs.config.ts`'s `features` widened to `"../specs/*.feature"`;
`scripts/check-steps.mjs` with the unused-step check; `web.yml`'s two steps; and the web
parts of every doc under "Docs". High effort: downloads, file choosers and the
clipboard behave differently in the two browser engines.

Acceptance:

```bash
<web>
<browsers>
cd web && npm run check-steps && npm run specs        # every shared scenario passes in both projects
node scripts/check-specs.mjs
cd e2e && npm run check-steps -- --all && npm run typecheck
```

- The specs run's list shows every feature without `@android` in both projects, and no
  `notifications`, `settings` or `release_smoke` scenario.
- Temporarily add a web step no feature uses: `npm run check-steps` fails (or, if
  `--unused-steps` doesn't exist, the log says so). Temporarily make the web import skip
  words it already has without counting them: `backup` fails on "Imported 1 word,
  skipped 1 already in your list.". Revert both.
- `<ci>`: the `web` job runs the shared specs in both browsers.

### review (Sonnet, high)

Review the whole piece against this spec and `GOALS.md`, independently. In particular:

- every feature is in `specs/`, and nothing references `e2e/features` (`grep -rn
  "e2e/features\|--spec features/" --exclude-dir=node_modules --exclude-dir=jogging .`
  prints nothing);
- every platform tag is one the platform forces, and its comment says why; nothing was
  tagged to make a failing scenario pass;
- each web step asserts what its Android twin asserts; read them side by side;
- the seed hook isn't in the production build, and nothing else test-only is;
- the specs run under the production CSP with the console-error fixture on;
- no war-story comments; the docs say what the code does.

High effort: this piece is the proof behind goal 5, and a web step that asserts less
than its Android twin would hide exactly the drift it exists to catch.

Run the full checks: `<web>`, `<browsers>`, `npm run check-steps`, `npm run specs` and
`npm run smoke` in `web/`; `node --test 'scripts/*.test.mjs'` and `node
scripts/check-specs.mjs`; `./gradlew testDebugUnitTest lintDebug`; in `e2e/`, `npm run
check-steps`, `npm run check-steps -- --all`, `npm run typecheck`, and the whole Android
suite on the phone (`npm run e2e`); and `<ci>` for the final commit. No version bump:
the piece is test-only, unless a parity fix changed the Android app, in which case
finish with `node scripts/bump-version.mjs patch`, commit, push and watch the release.

## What later pieces rely on

- **`web-push`**:
  - `notifications.feature` is `@android` at feature level. The web's reminder
    scenarios go in `specs/` too: shared where the wording and behaviour match (a
    Settings switch that reads on or off, say), `@web` with a comment where only the
    browser behaves that way. Playwright can grant the `notifications` permission in
    Chromium but can't receive a real push, so delivery stays a hand check on the
    iPhone list in `web/README.md`, and the scenarios cover what the page does.
  - Settings' "Daily reminder" section on the web lets `I open Settings` wait for the
    same thing on both platforms if `web-push` wants that; it isn't required.
  - The CSP change for the push server's origin is exercised by the specs run, since
    it runs under the production policy with the console-error fixture.
- **Any later piece** that adds behaviour writes its scenario in `specs/`, shared by
  default, implements its new steps in both `e2e/step-definitions/` and `web/steps/`,
  and keeps `node scripts/check-specs.mjs` and both `check-steps` green.
