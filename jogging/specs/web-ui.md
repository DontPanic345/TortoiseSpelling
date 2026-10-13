# Piece: web-ui

The web app's screens on top of `web-core`: Home, Review and practice, Completion,
Add/Edit with copy-prompt lookup, the word list and Settings. Also a service worker so
it works offline, a manifest and icons so it installs to the Home Screen, and a GitHub
Pages deploy. Source: `docs/testing-and-web-plan.md` ("Web app (PWA)", "Installing and
notifications on iPhone", "Points that don't map one to one", "Cost and distribution").

Builds on `web-core` as specified: `web/` with `idb`, Vitest and `fake-indexeddb`; the
domain port in `web/src/domain/`; `model.ts`, `backup.ts`, `db.ts` and
`createRepository` in `web/src/data/`; `golden/` with its JUnit and Vitest runners;
`testClock` and `seeded` in `web/test/support/`; and the `web` CI job. Through it, it
also builds on the Android app as `drop-api-key` leaves it: the screens, their
`XContent` split and component tests (`test-ui-layers`, `word-forms`, `copy-prompt`,
`drop-api-key`), and `icon`'s `docs/icon.svg`.

## What it delivers

- **Every Android screen, on the web**, with the same copy, the same rules and the same
  test ids: Home (Today card, completion panel, week strip, progress), Review and
  practice (the three phases, the diff, the mandatory retype, auto-advance), Completion,
  Add/Edit (the definition/form/example tree, **Copy prompt** and **Paste answer**,
  delete), the word list (search over every form, filter chips, suspend, delete) and
  Settings (Practice, Backup, About).
- **Web-only pieces the platform needs:** an Install section in Settings (Chrome's
  install prompt, or the iPhone's Share → Add to Home Screen steps); a request for
  persistent storage; and a Home nudge to export a backup while storage isn't persistent.
- **Offline.** A hand-written service worker precaches the whole build, so after the
  first load the app opens and works with no connection, like the Android app.
- **Installable.** A web app manifest (`display: standalone`), PNG and SVG icons made
  from `docs/icon.svg`, and the iOS meta tags. It works on iPhone with Safari 16.4 or
  newer.
- **Hosted on GitHub Pages** at `https://dontpanic345.github.io/TortoiseSpelling/`,
  deployed by a workflow on every push to main that changes the web app, after its
  checks pass.
- **Tests on three layers:** pure state tests and component tests in Vitest (jsdom),
  a few UI journeys over a real repository, and a Playwright smoke suite on the
  production build in Chromium and WebKit for what only a browser can show (offline,
  installability, file download and upload, the clipboard, persistence across reloads).

Goals it leans on:

1. **Nothing lost.** Storage is web-core's, unchanged. This piece asks the browser to
   keep it (`navigator.storage.persist()`), keeps export one tap away (Settings, and a
   Home nudge while storage isn't persistent), and the smoke suite imports an Android
   backup file in a real browser. A service worker update never reloads a page under a
   user mid-session.
2. **Reminder.** The web reminder is `web-push`'s. Until then Home's Today card is the
   "due today" the decision asks for. The service worker is hand-written so `web-push`
   can add `push` and `notificationclick` handlers to it.
3. **No API key.** The lookup is copy-prompt only. A Content Security Policy in
   the built `index.html` limits every fetch to the app's own origin, so the browser itself
   enforces that nothing calls out.
4. **Scheduling per root word.** Review records through web-core's `recordReview` at
   the first attempt, as on Android; practice records nothing; `markShown` is stamped
   when a card is first shown.
5. **Two apps that behave the same.** The copy is Android's word for word. Test ids are
   the Android tag values, with a test that checks the two lists match. The ViewModel
   helpers that decide what a screen shows get golden cases run by both apps
   (`golden/ui.json`), and each web component test copies its Android twin's cases.
6. **Free to run.** GitHub Pages on a public repo, and GitHub's free runners for CI.
7. **Simple.** One new runtime dependency (`preact`). The dev dependencies are `vite`,
   `@testing-library/preact`, `jsdom` and `@playwright/test`. There is no router, state,
   CSS, icon or service-worker library.

### Settled here (the docs and decisions leave these open)

- **Preact**, not Svelte, Lit or plain DOM code. It is a few kilobytes and uses plain
  TypeScript with JSX, and its hooks map onto the Android split: a stateless `XContent`
  that takes props and callbacks, and an `XScreen` that owns the state. Testing Library
  covers it in Vitest. Svelte needs its own compiler and file format, and Lit's custom
  elements make component tests and test ids harder. Plain DOM code would mean writing
  a renderer. JSX goes through Vite's own transform (`jsxImportSource: "preact"`), with
  no Preact Vite preset.
- **Hash routes** (`#/`, `#/review`, `#/practice`, `#/completion`, `#/add`,
  `#/edit/<id>`, `#/words`, `#/settings`). They need no server fallback on Pages, and the
  service worker only ever has to serve `index.html`. The router is a small module, not
  a dependency.
- **Relative base (`base: "./"`).** The build works at any path, so the Pages subpath,
  `vite preview` at `/` and a fork's Pages all work without configuration. The manifest's
  `start_url`, `scope` and `id` are `"./"`, and the service worker registers as
  `./sw.js`.
- **The service worker is hand-written** from `web/sw-template.js`. A small Vite plugin
  fills in the list of built files and a version hash. It uses cache-first for the
  app's own files, serves `index.html` for navigations, and calls `skipWaiting` and
  `clients.claim`. There's no update prompt: the build has no lazy chunks, so a running
  page already holds all its code, and the new version takes over on the next launch.
  Workbox would be a large dependency for about 40 lines of code (goal 7).
- **Browser APIs go behind a `Platform` interface**: clipboard, file save, storage
  persistence and install. Component and journey tests pass a fake, and only
  `browserPlatform.ts` touches `navigator`.
- **Export downloads the file**, except on touch-first devices that can share files
  (`navigator.canShare({ files })` and `(pointer: coarse)`), where it opens the share
  sheet. That is how an iPhone saves to Files. A cancelled share says nothing.
- **"Prompt copied." always shows on the web.** Browsers don't confirm a clipboard
  write, unlike Android 13 and later.
- **The answer field turns off the keyboard's help with attributes**:
  `autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false"`. It
  is `type="text"`, not `password`, so the iPhone's password autofill doesn't appear.
  It is never disabled or remounted between words, only made `readOnly` while a
  correct answer shows. On iOS, `focus()` outside a tap can't raise the keyboard, so
  keeping focus on one element is what keeps the keyboard up through a session.
- **Persistent storage is requested once Home has a word**, which is when Android asks
  for notification permission. The **backup nudge** shows on Home when there are words,
  `navigator.storage.persisted()` is false, and nothing has been exported in the last 30
  days. `lastExportedAt` is a new key in web-core's `settings` store (a new key in an
  existing store needs no `DB_VERSION` bump).
- **No reminder section in Settings yet.** `web-push` adds it. The cloud backup switch
  is Android-only (Google backup), and so is "Open app settings".
- **The web app has no version number.** About shows "Tortoise Spelling for the web"
  and the short commit it was built from (`GITHUB_SHA`, or "dev"). Web releases are
  deploys (the decision on releases), so there's no bump and no tag.
- **One `CHANGELOG.md` line** under `### Added` announces the web app. It goes out with
  the next Android release's notes, which is where users read news, but this piece
  doesn't bump the version.
- **The web UI's helper functions get golden cases** (`golden/ui.json`). Where Kotlin
  keeps such a helper inside a ViewModel, this piece moves it to a top-level function
  without changing what it does: `filterRows` and `importMessage`. That is a test-only
  change on Android, with no bump.
- **Smoke tests run in WebKit as well as Chromium.** Playwright's WebKit isn't iOS
  Safari, but it catches most of what would break there (`<dialog>`, regex lookbehind,
  IndexedDB, the service worker) and costs nothing on CI. A real iPhone is checked by
  hand from a list in `web/README.md`. That check is recorded as not done until Alan
  does it, and it doesn't block the piece.

## Design

### Project changes

```text
web/
  index.html            manifest, icons, iOS meta, compat.js, the module entry
  vite.config.ts        base "./", build target, the precache plugin, define __BUILD__
  sw-template.js        the service worker, plain JS (excluded from tsconfig)
  build/precache.ts     serviceWorkerSource(template, files): pure, unit-tested
  build/csp.ts          the Content Security Policy and the plugin that adds it to builds
  playwright.config.ts
  public/
    manifest.webmanifest
    compat.js           the unsupported-browser check, a classic script
    icons/              icon.svg, icon-192.png, icon-512.png, apple-touch-icon.png
  scripts/icons.mjs     rasterises docs/icon.svg with Playwright's Chromium
  src/
    main.tsx            opens the database, builds the container, registers the SW, renders
    app.tsx             App({ container }): the router switch
    styles.css          theme tokens, light and dark, and the components' classes
    ui/
      router.ts  container.ts  platform.ts  browserPlatform.ts  testIds.ts
      common/           TopBar, BackButton, Dialog, Snackbar, EmptyState, Stepper, icons.tsx
      home/  review/  complete/  add/  words/  settings/
  test/ui/              component, state and journey tests (jsdom)
  test/build/           precache.test.ts, icons.test.ts
  smoke/                Playwright *.spec.ts
golden/ui.json
```

`package.json` scripts: `dev` (`vite`), `build` (`tsc --noEmit && vite build`),
`preview` (`vite preview --port 4173 --strictPort`), `smoke` (`playwright test`), and
`icons` (`node scripts/icons.mjs`). `test` and `typecheck` stay as they are.
Dependencies are pinned with `~` at their current stable versions when build-1 runs:
`preact` (runtime), plus `vite` (the major that the installed Vitest supports),
`@testing-library/preact`, `jsdom` and `@playwright/test`. If `@testing-library/preact`'s
peer range doesn't include Preact's current major, pin the newest Preact it supports
and say so in the log.

`tsconfig.json` gains `"jsx": "react-jsx"` and `"jsxImportSource": "preact"`, and adds
`build`, `smoke` and the two config files to `include`. `vitest.config.ts` gains
`include: ["test/**/*.test.{ts,tsx}"]`, so Vitest never picks up `smoke/`. UI test
files start with `// @vitest-environment jsdom`; the domain and data tests stay on
`node`. Testing Library cleans up after each test, through a setup file if its
auto-cleanup needs Vitest's globals.

`vite.config.ts`: `base: "./"`; `esbuild: { jsx: "automatic", jsxImportSource:
"preact" }` (or the equivalent option on the Vite major in use); `build.target`
includes `safari16.4`; no dynamic `import()` anywhere in `src/`; `define: { __BUILD__:
JSON.stringify(process.env.GITHUB_SHA?.slice(0, 7) ?? "dev") }`; and the `csp()` and
`precache()` plugins (below).

### Shell

**`index.html`**: `lang="en-NZ"`; `<meta name="viewport"
content="width=device-width, initial-scale=1, viewport-fit=cover">`; `<title>Tortoise
Spelling</title>`; `theme-color` twice, `#F7F4EE` for `(prefers-color-scheme: light)` and
`#141615` for dark; `<link rel="manifest">`, an SVG favicon and `apple-touch-icon`;
`<meta name="apple-mobile-web-app-title" content="Tortoise Spelling">`. The production
build also gets this policy, from `build/csp.ts`:

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self';
  style-src 'self'; img-src 'self' data:; connect-src 'self'; manifest-src 'self';
  worker-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'">
```

`build/csp.ts` exports the policy as a constant and a `csp()` Vite plugin that inserts
the tag with `transformIndexHtml`, for builds only (`apply: "build"`). The dev server
injects CSS through `<style>` elements, which this policy would block.

`<script src="compat.js">`, a classic script, sets `window.__unsupported` and writes a
message into `#app` if `new RegExp("(?<!a)b")` throws or `indexedDB` is missing:
"Tortoise Spelling needs Safari 16.4 or newer, or a current Chrome, Edge or Firefox."
`main.tsx` stops if the flag is set. A `<noscript>` says the app needs JavaScript.

**`main.tsx`** opens the database. If that fails, it renders "Tortoise Spelling can't
store words in this browser. Check that it isn't blocking site data for this page."
Otherwise it builds `container = { repository: createRepository({ db }), clock:
deviceClock, platform: browserPlatform(), autoAdvanceMillis: 1100 }`, renders `<App
container={container} />`, and in production builds registers `./sw.js`. Web-core's
`openDatabase` gains an optional `onVersionChange` callback. With it, the app shows a
snackbar with a Reload action: "Tortoise Spelling was updated in another tab. Reload to
keep going."

**`ui/container.ts`**: the `AppContainer` type, `ContainerContext` and
`useContainer()`. That mirrors `AppContainer` and `rememberAppContainer()`: tests render
`<App>` or any `XScreen` with a container of their own.

**`ui/router.ts`**: `type Route = { name: "home" | "review" | "practice" | "completion"
| "add" | "words" | "settings" } | { name: "edit", id: number }`. It has
`parseRoute(hash)` (unknown routes become home), `routeHash(route)`, `useRoute()`
(listening to `hashchange`), `navigate(route)` (push), `replace(route)`, and
`back(fallback)`. `back` calls `history.back()` if this page load has pushed a route,
and otherwise `replace(fallback)`, so a deep-linked `#/settings` still goes back home.
The navigation follows `MainActivity`'s graph:

| From | Action | Web |
|---|---|---|
| Home | Start / Practise more / Add word / All words / See all / Settings | `navigate` |
| Review | finished | `replace(completion)` (Android's `popUpTo(REVIEW, inclusive)`) |
| Review, Practice | End session; practice finished | `back(home)` |
| Completion | Done | `back(home)`; Practise more `navigate(practice)` |
| Add, Edit | back; edit saved or deleted | `back(home)` / `back(words)` |
| Words | a row | `navigate(edit)` |
| Settings | back | `back(home)` |

`App` renders one screen per route, keyed by the route's hash, so entering `#/review`
always mounts a fresh session (Android's new back-stack entry). A fresh load of
`#/review` starts a session. That is the deep link `web-push` will use.

**`ui/platform.ts`**:

```ts
export type InstallState = "installed" | "prompt" | "ios" | "unavailable";
export interface Platform {
  copyText(text: string): Promise<boolean>;
  saveFile(name: string, text: string): Promise<"saved" | "cancelled">;   // throws on failure
  persistStorage(): Promise<boolean>;
  storagePersisted(): Promise<boolean>;
  installState(): InstallState;
  onInstallStateChange(listener: () => void): () => void;
  promptInstall(): Promise<void>;
}
```

`browserPlatform.ts`:

- `copyText` uses `navigator.clipboard.writeText`.
- `saveFile` shares on touch-first devices that can share files; otherwise it uses an
  object URL and `<a download>`. An `AbortError` from sharing returns `"cancelled"`.
- `persistStorage` and `storagePersisted` return false where `navigator.storage` lacks
  the call.
- `installState`: `"installed"` when `matchMedia("(display-mode: standalone)")` matches
  or `navigator.standalone` is set. `"prompt"` once a `beforeinstallprompt` event has
  been captured with `preventDefault()`, and back to `"unavailable"` after
  `appinstalled`. `"ios"` on iPhone, iPad and iPod (including an iPad that reports
  itself as a Mac with touch points). Otherwise `"unavailable"`.
  `test/support/fakePlatform.ts` records calls and returns what a test sets.

**Theme (`styles.css`)**: custom properties named after the Material roles in `Theme.kt`
(`--primary`, `--on-primary`, `--primary-container`, … `--outline-variant`), plus the
feedback colours (`--correct`, `--correct-container`, `--wrong`). They hold the light
values from `Color.kt`/`Theme.kt`, with the dark values under `@media
(prefers-color-scheme: dark)`. The body font is `system-ui`. The `.word` style (the
answer field, the Correct word, the diff rows) is `ui-monospace, monospace`, 30px, weight
500, letter-spacing 2px, as `WordStyle`. Safe-area insets pad the top bar and the
bottom. Styles live in classes; the only inline styles are style objects for computed
values (progress segment weights). The layout is one column, at most 600px wide and
centred, which is a phone's layout on any screen.

**`ui/common/`**:

- `TopBar` (title, optional navigation button, actions).
- `BackButton` (`aria-label="Back"`).
- `Dialog`, around `<dialog>` with `showModal()`. Escape and a click on the backdrop
  dismiss it, as on Android.
- `Snackbar`: one message at a time, `role="status"`, 4 s, with an optional action,
  and a `useSnackbar()` hook per screen.
- `EmptyState`.
- `Stepper` (− value +, `aria-label`s "Decrease" and "Increase").
- `icons.tsx`: inline SVG components using Material Symbols' path data, with
  `aria-hidden` and the label on the button. These are add, more, back, close, delete,
  pause-circle, play-circle, check, content-copy and content-paste.

**Test ids (`ui/testIds.ts`)**: the values from `TestTags.kt` as `drop-api-key` leaves
it, rendered as `data-testid`. That includes the functions (`wordRow(normalizedText)`,
`wordFilter(name)`, `addWordFormText(d, f)` and the rest). Leave out the three
Android-only tags: the reminder switch, the reminder time button and the cloud backup
switch. Add one web-only id, `home_backup_nudge`. `test/ui/testIds.test.ts` reads
`TestTags.kt` with `node:fs`, takes every `const val X = "…"` value and every function's
string prefix, and checks the web list holds each one except the Android-only three,
with no extras except the web-only ones. Both exception lists are named constants in
the test.

### Screens

Each screen is `ui/<screen>/<Name>Screen.tsx`, holding:

- `XScreen`, which uses the container and the state hook, handles navigation and the
  snackbar, and subscribes to `repository.subscribe`.
- `XContent(props)`, which takes state and callbacks, uses no container, and is what
  component tests render.

The logic that Android keeps in a ViewModel goes in `ui/<screen>/<name>State.ts` as pure
functions over a state type, so it can be unit-tested. **The copy is Android's.** Every
string a screen shows is copied from the Kotlin as `drop-api-key` leaves it. Strings
that only the web shows are listed below.

**Refreshing.** Every screen that shows stored data re-reads it when it mounts, on
`repository.subscribe`, and on `visibilitychange` to visible. That last one is Android's
`ON_RESUME`, so counts move with the clock across midnight.

**Home** (`home/`). `homeState.ts`'s `loadHome(repository, clock)` builds Android's
`HomeUiState`:

- `markTodaySatisfied()` when there are words and the plan is clear;
- the greeting from `greeting(hourOf(clock))`;
- `dateLabel(day, locale?)`: weekday, day and month from
  `Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long",
  timeZone: "UTC" }).formatToParts`, joined in Android's fixed "EEEE d MMMM" order, so
  `"en"` gives "Monday 14 September";
- `today`.

`HomeContent`:

- The first-run panel and "How it works".
- The greeting and date.
- The Today card (`home_practice_count`, Start), or the completion panel with "Practise
  a few more anyway".
- The week card (`home_week`). Each dot has an `aria-label` such as "Today, practised",
  and the narrow weekday letter comes from `Intl` in the browser's locale.
- The words card (`home_progress`), whose progress bar has the label "N known, N
  learning, N new".
- The More menu (Add word, All words, Settings), and the Add word button (`home_add_word`).

Web-only:

- Once the state has words, `HomeScreen` calls `platform.persistStorage()` if
  `storagePersisted()` is false, at most once per page load.
- The backup nudge (`home_backup_nudge`), below the words card, under the rule above. It
  is a card with the text "This browser can clear its storage. Export a backup now and
  then, so you never lose your words." and an Export button, which runs Settings' export.

**Completion** (`complete/`). `CompletionPanel(props)` is Android's: the headline from
`completionHeadline`, the practised line, the streak, the next review line and the quiet
"Practise a few more anyway". `CompletionScreen` loads Home's state and adds Done.

**Review** (`review/`). `reviewState.ts` ports `ReviewViewModel`'s state machine as pure
transitions. Each one returns the new state and at most one effect:

```ts
type ReviewPhase = { kind: "prompting" } | { kind: "correct" }
  | { kind: "corrective"; attempt: string; diff: SpellingDiff; revealed: boolean; retypeMissed: boolean };
type ReviewEffect = { record: { wordId: number; correctFirstTry: boolean; typed: string } }
  | { autoAdvance: number /* index */ } | { markShown: ReviewCard } | null;
```

- `loaded`, `inputChanged`, `submit`, `showAnswer`, `advance` and `autoAdvanceDue` take
  the same branches as the Kotlin (first attempt, second attempt, retype, Continue).
  The comparison is `normalizeWord(typed) === card.answer`, and the diff is
  `spellingDiff(card.form, typed)`.
- `record` effects are dropped in practice mode.
- A card that becomes current yields `markShown`, in practice mode too.
- `ending`, `position`, `total` and `blankedExample` are derived as in `ReviewUiState`.
- `ReviewScreen` runs the effects: `recordReview`, `markShown`, and a timer of
  `container.autoAdvanceMillis` that is cleared on unmount.

`ReviewContent`:

- The title, "N / M" or "Extra practice", with "End session" (close icon).
- The progress bar.
- The hint line, the definition, and the blanked example: `BLANK_PLACEHOLDER` drawn as
  a fixed-width underline, with "_____" kept as the accessible text in a visually hidden
  span. Without an example, the standalone blank and "type the word".
- The answer field (`review_answer`), with the attributes above and
  `enterkeyhint="done"`. Enter submits, and the label follows the phase.
- The feedback: Correct with `review_correct_word`, or Not quite with the diff rows,
  "Show answer" and the retype message. Each diff row is a span per UTF-16 unit, the
  first divergence highlighted, as `DiffRow`.
- The submit button (`review_submit`), with the same enabled rule and labels, and no
  button while `ending`.

After a phase change, the answer area scrolls into view with `scrollIntoView({ block:
"nearest" })` on the next frame, since the iPhone's keyboard covers the bottom.

**Add/Edit** (`add/`). `addWordState.ts` ports `AddWordUiState` as `drop-api-key`
leaves it: `editingId`, `text`, `content`, `paste`, `message`, `addedThisSession`,
`totalWords`, `isEditing`, `canSave`, `canCopyPrompt`, `applying(answer)`, and the paste
transitions (`openPaste`, `pasteTextChanged` → `parsePastedLookup`, `usePaste`,
`dismissPaste`). `edit(state, contentEdit)` applies web-core's `apply`. Saving:

- A new word goes through `addWord`. "Added ✓ (N total)", or the duplicate or blank
  message, and the form clears with the burst counter carried forward.
- An edit goes through `updateWord`, then `back(words)`, or the duplicate message.
- Delete in the top bar deletes at once, as on Android, then `back(words)`.

`AddWordContent` has:

- The word field (`add_word_text`), focused on mount and after each add.
- Copy prompt (`add_word_copy_prompt`, enabled by `canCopyPrompt`) and Paste answer
  (`add_word_paste`), with the help text below them.
- The tree editor. It has the headings, fields, add and remove buttons, "Required"
  hints and the `exampleMissesForm` warning in `word-forms`' layout, and every tag
  `word-forms` names (`add_word_definition`, `add_word_part_of_speech`,
  `add_word_example`, `add_word_add_definition`, `add_word_form_text_<d>_<f>`, …).
- Save (`add_word_save`, labelled "Add word" or "Save changes") and the burst line.

The paste dialog follows `copy-prompt`:

- The title is "Paste the answer". It holds a textarea labelled "The chat's answer"
  (`add_word_paste_text`), focused on open, with `aria-invalid` for an invalid answer.
- The supporting text is "Paste the chat's whole reply.", the invalid message, or the
  summary. The rename and replace lines appear under the same conditions.
- Use this (`add_word_paste_use`, enabled only for a valid answer) and Cancel.

Copy prompt calls `platform.copyText(lookupPrompt(state.text))`. Then it shows "Prompt
copied.", or "Couldn't copy the prompt." when the copy fails (web-only). The app never
reads the clipboard.

**Word list** (`words/`). `wordListState.ts` holds `query`, `filter`, `filterCounts`,
`rows`, `totalCount`, `loading` and `isFiltering`, built with `filterRows` and
`wordFilterCounts` from `wordsWithContent()`. `WordListContent` has:

- "All words (N)", the search field (`word_list_search`), and the filter chips
  (`word_filter_row`, `word_filter_<name>`, "Due 3"), hidden with no words.
- Each row (`word_row_<normalizedText>`): the text, the first definition, the status
  badge (`word_row_status_<…>`), "Suspend word"/"Resume word" and "Delete word".
- The empty and no-match states, and the delete dialog: "Delete “x”?", "Its review
  history goes too. This can't be undone.", Delete and Cancel.

**Settings** (`settings/`). `SettingsContent` sections, top to bottom:

- **Install** (web-only), shown only for `"prompt"` and `"ios"`:
  - For `"prompt"`: "Install Tortoise Spelling so it opens like an app, works offline
    and is less likely to lose your words." and an Install button
    (`platform.promptInstall()`).
  - For `"ios"`: "On iPhone or iPad, tap Share, then Add to Home Screen. It then opens
    like an app and is less likely to lose your words."
- **Practice**: the "New words per day" stepper (`settings_new_words_value`,
  `settings_new_words_decrease`, `settings_new_words_increase`, from 1 to 100).
- **Backup**: Android's help text, then the web-only "On the web, your words are kept in
  this browser on this device. A backup moves them to another browser or to the Android
  app." Then Export and Import (disabled while busy).
  - Export: `exportBackup()`, `platform.saveFile("tortoisespelling-backup.json", …)`,
    `setLastExportedAt(clock.millis())`, then "Backup saved.". Nothing is shown when the
    user cancels, and "Couldn't write that file." when it fails.
  - Import: a hidden `<input type="file" accept=".json,application/json,text/plain">`,
    `file.text()`, `importBackup`, then `importMessage(added, skipped)`, the
    `BackupFormatError` message, or "Couldn't read that file.".
- **About**: "Tortoise Spelling for the web (`__BUILD__`)" and Android's
  "Free and open source…" line, with the Privacy policy and Source code links (Android's
  URLs, opened in a new tab with `rel="noopener"`).

### Golden cases for the UI helpers (`golden/ui.json`)

The same format and runners as web-core's files: `UiGoldenTest` in the Kotlin golden
package, and `ui.test.ts` in `web/test/golden/`.

| Function | Kotlin | Cases |
|---|---|---|
| `statusLabel(word, today)` | `ui/words/WordListViewModel.kt` | suspended, new, due today, overdue, tomorrow, in N days |
| `noMatchesBody(query, filter)` | same | the three branches |
| `filterRows(words, query, filter, today)` | new top-level `internal fun` in the same file, moved out of `WordListViewModel.filtered` unchanged | a form-only match ("practise" finds "practice"), case and spacing, a filter and query together, blank query; the output is `{ text, status, definition }` per row |
| `completionHeadline(nextDueDay, today)` | `ui/complete/CompletionPanel.kt` | tomorrow, later, null |
| `importMessage(added, skipped)` | new top-level `fun` in `SettingsViewModel.kt`, moved out of `importFrom`'s `buildString` unchanged | 0/0, 1/0, 2/0, 1/3 |
| `blankedExample(form, example)` | `ReviewUiState.blankedExample` for a one-card queue | no example, blank, found, not found |
| `canSave(text, content)` | `AddWordUiState.canSave` | blank word, incomplete content, complete |
| `applying(state, answer)` | `AddWordUiState.applying` | with and without `renames`; editing state kept |

The two Kotlin moves change no behaviour. `WordListViewModel` and `SettingsViewModel`
call the new functions.

### Service worker

`sw-template.js`, plain JavaScript, about 40 lines:

```js
const VERSION = "__VERSION__";
const FILES = __FILES__;            // relative to the worker's scope, "./" first
const CACHE = `tortoisespelling-${VERSION}`;
// install: cache every file, then skipWaiting(). activate: delete every other
// tortoisespelling-* cache, then clients.claim(). fetch: GET, same origin only;
// navigations get the cached "./" (index.html); everything else cache-first,
// falling back to the network.
```

`build/precache.ts` exports `serviceWorkerSource(template, files: { name: string;
source: string | Uint8Array }[])`. It replaces `__FILES__` with `["./", …names]`,
leaving out `sw.js` and source maps, and replaces `__VERSION__` with the first 12 hex
digits of a SHA-256 over every file's name and contents in sorted order. Any change to
any file therefore changes the version. The `precache()` plugin calls it in
`generateBundle` with the bundle and the copied `public/` files, and emits `sw.js`.
`main.tsx` registers it with `navigator.serviceWorker.register("./sw.js")` after `load`,
in production only (`import.meta.env.PROD`).

### Manifest and icons

`public/manifest.webmanifest`:

- `name` and `short_name` "Tortoise Spelling", and `description` "Learn to spell your
  own word list, a few minutes a day.";
- `start_url`, `scope` and `id` all `"./"`, and `display` `"standalone"`;
- `background_color` and `theme_color` `"#F7F4EE"`, and `lang` `"en-NZ"`;
- `icons`: `icon.svg` (`sizes: "any"`), the 192 and 512 PNGs (purpose `any`), and the
  512 PNG again with purpose `maskable`. `docs/icon.svg` is full-bleed with its art
  inside the adaptive icon's safe zone, which is smaller than a maskable icon's.

`scripts/icons.mjs` launches Playwright's Chromium and loads `docs/icon.svg` at each
size with a transparent page. It screenshots `icon-192.png`, `icon-512.png` and
`apple-touch-icon.png` (180, which must be opaque: the SVG's background is),
and copies the SVG to `public/icons/icon.svg`. Generated files are committed. If the
icon changes, rerun `npm run icons`. `test/build/icons.test.ts`: the copied SVG equals
`docs/icon.svg` byte for byte, and each PNG's IHDR width and height are what the
manifest says. Pixels aren't compared, since rasterisers differ by platform.

### Smoke tests (`web/smoke/`)

`playwright.config.ts`:

- Two projects, `chromium` and `webkit`. `baseURL` is `process.env.SMOKE_URL ??
  "http://localhost:4173/"`.
- When `SMOKE_URL` is unset, `webServer` runs `npm run build && npm run preview`.
- A fixture fails any test that logs a console error or a page error, so a CSP
  violation fails.
- Each test gets a fresh browser context, and so fresh storage.

| File | Checks |
|---|---|
| `journey.spec.ts` | First run shows "No words yet". Add "rhythm" by hand. Home shows 1 word to practise. Start, type it, see "Correct" and the completion panel. Reload: still 1 word, all done. |
| `offline.spec.ts` | Wait for `navigator.serviceWorker.ready` and a controller. `context.setOffline(true)`, reload: Home renders. Add a word offline, reload offline: it's there. |
| `install.spec.ts` | The manifest loads and parses with the fields above, and every icon URL returns 200 with its type. The `apple-touch-icon` link resolves. Chromium only: CDP `Page.getInstallabilityErrors` returns none. |
| `backup.spec.ts` | Import `golden/backup/android-tree.json` through the file input: "Imported 3 words.", and the list shows them. Export: the download's JSON has `version` 1 and the three words with their `definitions`. |
| `clipboard.spec.ts` | Chromium only, with clipboard permissions granted: type "rhythm", Copy prompt, and `navigator.clipboard.readText()` starts with `I'm learning to spell "rhythm".` |

If one check can't work in Playwright's WebKit (service worker offline is the likely
one), that test calls `test.skip(browserName === "webkit", "<reason>")`, and the log
and this spec record it.

### CI and deploy

- **`.github/workflows/web.yml`** (new, `workflow_call` only), "Web checks":
  - checkout and Node 22 with the npm cache on `web/package-lock.json`;
  - `npm ci`, `npm run typecheck`, `npm test`, `npm run build`;
  - `npx playwright install --with-deps chromium webkit`, then `npm run smoke`, all in
    `web/`;
  - on failure, upload `web/playwright-report/` and `web/test-results/`.

  `ci.yml`'s `web` job becomes `web: uses: ./.github/workflows/web.yml`, and its
  header comment says so.
- **`.github/workflows/pages.yml`** (new):
  - Triggers: `push` to `main` with `paths: [web/**, golden/**, docs/icon.svg,
    .github/workflows/pages.yml, .github/workflows/web.yml]`, and `workflow_dispatch`.
  - `permissions: { contents: read, pages: write, id-token: write }`, and `concurrency:
    { group: pages, cancel-in-progress: false }`.
  - `check: uses: ./.github/workflows/web.yml`.
  - `deploy`: `needs: check`, `environment: github-pages` with the deployed URL. It
    builds with `GITHUB_SHA` in the environment, then runs
    `actions/configure-pages`, `actions/upload-pages-artifact` (`path: web/dist`) and
    `actions/deploy-pages`, each at its current major.
  - A header comment says the site is a deploy, not a release: no tag and no version.
- **Pages must be switched on once**, under Settings → Pages → Source: GitHub Actions.
  A session can't do that: the proxy blocks the Pages API, and `GITHUB_TOKEN` can't
  enable Pages. If build-7's first deploy fails because Pages isn't enabled, the step is
  blocked with that one request to Alan (see build-7).
- Dependabot: web-core's `/web` npm entry covers the new packages, and the
  `github-actions` entry covers the new actions. No change.

### Docs

- **`CLAUDE.md`**:
  - Commands: `cd web && npm run dev`, `npm run build`, `npm run smoke` (with
    `SMOKE_URL=… npm run smoke` against a deployed site) and `npm run icons`.
  - The layers table gets two rows. "Web state, component and journey tests |
    `web/test/ui/` | Node + jsdom". "Web smoke tests | `web/smoke/` | Chromium and
    WebKit via Playwright, on the production build".
  - The CI bullet gets `web.yml`. The Release section gets `pages.yml`: deploys on
    push, after the web checks, with no version.
  - The "Web app" section gets:
    - Preact, with `XScreen`/`XContent` and `<name>State.ts` mirroring the Android split;
    - hash routes and `back(fallback)`;
    - `Platform`, which is the only code that touches `navigator`;
    - the copy is Android's, and test ids are the `TestTags.kt` values, checked by
      `testIds.test.ts`;
    - `golden/ui.json`;
    - the hand-written service worker, and when its version changes;
    - the CSP, and that a new origin (`web-push`) must be added there deliberately;
    - Safari 16.4 as the minimum;
    - the review field's attributes and why it is never remounted (iOS keyboard);
    - storage persistence and the backup nudge.
- **`README.md`**: a "Web app (iPhone, iPad and any browser)" section. It gives the
  URL, "Open it in Safari, tap Share, then Add to Home Screen" (and Chrome's Install),
  what's missing (the daily reminder, for now), that words stay in that browser so
  export now and then, and that backups move between the two apps.
- **`PRIVACY.md`**: a "The web app" section covering these points:
  - It keeps the same things as the Android app, in the browser's storage for the site
    on that device (IndexedDB), plus a cached copy of the app (a service worker).
    Clearing the site's data deletes them.
  - Nothing is sent anywhere. The pages are served by GitHub Pages, so loading or
    updating the app is a request to GitHub, which sees your IP address as any website
    host does (GitHub's privacy statement covers it). The app makes no other requests,
    and its Content Security Policy stops it contacting any other site.
  - Copy prompt only writes to the clipboard, and the app never reads the clipboard.
  - There are no cookies and no analytics.

  The opening paragraph mentions the web app.
- **`CHANGELOG.md`**, under `[Unreleased]` → `### Added`: "**Tortoise Spelling for the
  web**, for iPhone, iPad and any browser, at
  https://dontpanic345.github.io/TortoiseSpelling/. It does everything the Android app
  does except the daily reminder, works offline once opened, installs to the Home
  Screen, and reads and writes the same backup files, so your words can move between
  the two."
- **`web/README.md`**: the commands, the layout above, the smoke suite, and the
  **iPhone check by hand**:
  - install from Safari;
  - it opens standalone with the icon;
  - add a word with Copy prompt and Paste answer through a chat app;
  - review it with the keyboard staying up between words and no autocorrect or
    suggestions;
  - export to Files and import it back;
  - in airplane mode, it opens and works.
- **`docs/testing-and-web-plan.md`**:
  - The status line says the web screens are built and deployed.
  - The porting table's framework row says Preact, and the `TestTags.kt` row says
    `data-testid` with the same values.
  - The Playwright and GitHub Pages **(unverified)** marks go.
  - "Open questions" marks the framework, the hosting and "ships without push" as
    decided.

## Build steps

Each step follows `CLAUDE.md`'s Workflow and `PROTOCOL.md`. No step changes the APK's
behaviour. Only build-1 touches Android code (two moves with no behaviour change), so
it alone runs Gradle and the e2e features that cover the moved code. The phone isn't
needed otherwise. "Passing" means every command exits 0. Abbreviations:

- `<web>`: `cd web && npm ci && npm run typecheck && npm test && npm run build`
- `<smoke>`: `cd web && npx playwright install --with-deps chromium webkit && npm run
  smoke`. In the cloud, if WebKit's system dependencies won't install, run
  `npx playwright install --with-deps chromium && npm run smoke -- --project=chromium`,
  say so in the log, and rely on the CI run for WebKit.
- `<ci>`: push, then `gh run list --commit $(git rev-parse HEAD)` and `gh run watch` on
  each run until it's green.

### build-1: the toolchain, the shell and the UI golden cases (Sonnet, high)

This covers "Project changes" (without the service worker, the icons and Playwright),
"Shell", the common components, `testIds.ts` with its test, and `golden/ui.json` with
both runners and the two Kotlin moves. For now `App` renders a placeholder per route.
High effort: it sets the conventions, the JSX and test setup, and the golden wiring that
every later step uses.

Tests:

- `router.test.ts`: `parseRoute`/`routeHash` both ways for each route, unknown routes
  become home, a non-numeric edit id becomes home, and `back` replaces when nothing was
  pushed.
- `testIds.test.ts`, as above.
- `common.test.tsx`: Dialog opens and closes, Escape dismisses it; Snackbar shows one
  message then clears; Stepper's buttons are disabled at its bounds.
- The `ui.json` runners on both sides.

Acceptance:

```bash
<web>
./gradlew testDebugUnitTest lintDebug          # UiGoldenTest passes with the rest
cd e2e && npm run e2e -- --spec features/word_list.feature --spec features/backup.feature
grep -rn "navigator\." web/src | grep -v browserPlatform.ts   # prints nothing
```

- `grep -c "Content-Security-Policy" web/dist/index.html` prints 1, and `grep -c
  "unsafe-inline" web/build/csp.ts` prints 0. `npm run dev` serves the placeholder
  screens with no console errors (check one route with `curl` and stop the server).
- Temporarily add a value to `TestTags.kt` that the web list lacks: `testIds.test.ts`
  fails. Temporarily make the TypeScript `filterRows` match only the root: a `ui.json`
  case fails on the web side. Revert both.
- `<ci>`.

### build-2: Home and Completion (Sonnet, medium)

`home/` and `complete/`: the state, `HomeContent`, `CompletionPanel`,
`CompletionScreen`, refreshing, the storage persistence request, the backup nudge,
`lastExportedAt` in the settings store, and the export call the nudge shares with
Settings. That export lives in `ui/backupActions.ts` (`exportWords(container)` and
`importWords(container, file)`, returning the message to show).

Tests (jsdom):

- `homeState.test.ts`: a clear plan with words marks today satisfied, and one without
  words doesn't; `dateLabel(…, "en")` reads "Monday 2 March" on `testClock`'s day.
- `HomeContent.test.tsx`: every case in Android's `HomeContentTest`, by visible text and
  test id. The week dots' labels. The nudge shows only under its rule (persisted, no
  words, a recent export, and the case where it shows).
- `CompletionPanel.test.tsx`: every case in `CompletionPanelTest`.
- `HomeScreen.test.tsx`, with a real repository on `fake-indexeddb` and `fakePlatform`:
  `persistStorage` is called once words exist and not before; a word added through the
  repository while Home is mounted updates the count (`subscribe`).

Acceptance:

```bash
<web>
```

- Temporarily drop the `markTodaySatisfied` call: `homeState.test.ts` fails. Revert.
- `<ci>`.

### build-3: Review and practice (Sonnet, high)

`review/`: `reviewState.ts`, `ReviewContent`, `ReviewScreen`, the effects, and the
review and practice routes. High effort: the phase machine and the record-at-first-
attempt rule are where a port can quietly change scheduling.

Tests (jsdom):

- `reviewState.test.ts`, one test per Kotlin branch:
  - a correct first attempt gives `record(true)` and auto-advance;
  - a miss gives `record(false)` with the trimmed attempt and a corrective phase that
    isn't revealed;
  - a correct second attempt gives no record;
  - a wrong second attempt reveals;
  - Show answer reveals;
  - a retype miss sets `retypeMissed`, and a retype hit advances;
  - auto-advance for an old index is ignored;
  - practice mode never yields `record`;
  - each newly current card yields `markShown`;
  - the comparison uses `card.answer`, so typing "ran" for the form "ran" is correct.
- `ReviewContent.test.tsx`: every case in Android's `ReviewContentTest`, plus:
  - the answer field has the four keyboard attributes;
  - the field element is the same node before and after a word changes;
  - the blank's accessible text is "_____".
- `journeys.test.tsx`: `<App>` over a real repository, `testClock`, `fuzz = (t, d) => t +
  d`, `fakePlatform` and `autoAdvanceMillis: 0`:
  - *scheduling*: add through the repository, Start, answer correctly, and the
    completion panel shows; the word's `dueOn` is today + 1.
  - *lapse*: answer wrong, Show answer, retype, and the session finishes; one log row
    with `correct` false.
  - *practice*: Practise a few more, answer, and every scheduling field and the log
    count are unchanged.

Acceptance:

```bash
<web>
```

- Temporarily record at the retype instead of the first attempt: `reviewState.test.ts`
  and the lapse journey fail. Temporarily let practice record: the practice journey
  fails. Revert both.
- `<ci>`.

### build-4: Add and edit, with copy-prompt lookup (Sonnet, high)

`add/`: the state, the tree editor, Copy prompt, the paste dialog, save, delete, and the
add and edit routes. High effort: the editor is the largest screen, and the paste
dialog's states are a contract with the shared specs.

Tests (jsdom):

- `addWordState.test.ts`: `canCopyPrompt`; the paste transitions; `usePaste` with an
  invalid result does nothing; a save after an add clears the form and carries the burst
  counter forward.
- `AddWordContent.test.tsx`: every case in Android's `AddWordContentTest` as
  `word-forms`, `copy-prompt` and `drop-api-key` leave it. That covers the tree's add
  and remove buttons, the base form with no text field, "Required", the missing-form
  warning, the copy and paste buttons, and the dialog's invalid, valid, rename and
  replace states.
- `journeys.test.tsx` gains:
  - *lookup*: type "practice", Copy prompt (`fakePlatform` holds `lookupPrompt
    ("practice")`), paste the `docs/copy-prompt-lookup.md` example in a fence, see the
    summary, Use this, Save. The word list's search for "practise" finds it.
  - *edit keeps scheduling*: edit a reviewed word's definition and save; its SM-2
    fields and log are unchanged.

Acceptance:

```bash
<web>
```

- Temporarily enable Use this for an invalid result: `AddWordContent.test.tsx` fails.
  Revert.
- `<ci>`.

### build-5: the word list and Settings (Sonnet, medium)

`words/` and `settings/`: search, filters, suspend and delete; the Install, Practice,
Backup and About sections; import through `backupActions.ts`; `browserPlatform`'s
`saveFile` and install state.

Tests (jsdom):

- `WordListContent.test.tsx`: every case in Android's `WordListContentTest`, plus a
  form-only search match.
- `SettingsContent.test.tsx`: the cases from Android's `SettingsContentTest` that apply
  on the web (section order, the stepper, Export and Import disabled while busy). There
  is no "Daily reminder" or Google backup node. Install shows for `"prompt"` (with its
  button) and `"ios"` (text only), and not for `"installed"` or `"unavailable"`.
- `backupActions.test.ts`: export sets `lastExportedAt` and says "Backup saved."; a
  cancelled save says nothing and doesn't set it; importing a backup file built by
  `exportBackup` says "Imported 2 words."; importing "not json" gives the
  `BackupFormatError` message.

Acceptance:

```bash
<web>
```

- Temporarily drop `setLastExportedAt` from export: `backupActions.test.ts` fails.
  Revert.
- `<ci>`.

### build-6: offline, install and the smoke suite (Sonnet, high)

"Service worker", "Manifest and icons", "Smoke tests", `web.yml` and `ci.yml`'s use of
it. High effort: service worker caching and browser automation are where the
environment differs from local runs.

Tests: `test/build/precache.test.ts` checks the following.

- The output lists `./` and every file, but not `sw.js` or `.map` files.
- Changing one byte of one file changes the version, and reordering the input doesn't.
- No placeholder is left in the output.

Plus `icons.test.ts` and the five smoke specs.

Acceptance:

```bash
<web>
cd web && npm run icons && git diff --exit-code public/icons/icon.svg   # the SVG copy is current
<smoke>
grep -c '"./' web/dist/sw.js                    # at least 1: the precache list is filled in
```

- Temporarily make the fetch handler skip navigations: `offline.spec.ts` fails.
  Temporarily add an inline `<script>` to `index.html`: the console-error fixture fails
  the smoke run (CSP). Revert both.
- `<ci>`: the `web` job runs the smoke suite in both browsers.

### build-7: GitHub Pages and the docs (Sonnet, medium)

`pages.yml`, then everything under "Docs".

Acceptance:

```bash
<web>
./gradlew testDebugUnitTest lintDebug
grep -n "Unreleased" -A8 CHANGELOG.md          # the web app line is there
```

- `<ci>`, including the `pages.yml` run for the commit. If its deploy fails because
  Pages isn't enabled for the repo, follow `PROTOCOL.md`'s Blockers. Mark the step and
  the piece blocked with `"blocker": "Enable GitHub Pages for DontPanic345/TortoiseSpelling:
  Settings → Pages → Build and deployment → Source: GitHub Actions. Reply when it's on and
  the next session re-runs the deploy."`. Commit the docs that pass, and stop. When
  unblocked, run the workflow again (`gh workflow run pages.yml`) and carry on from here.
- `curl -fsS https://dontpanic345.github.io/TortoiseSpelling/ | grep -c "Tortoise Spelling"`
  is at least 1, and `curl -fsSI …/sw.js` and `…/manifest.webmanifest` return 200.
- `cd web && SMOKE_URL=https://dontpanic345.github.io/TortoiseSpelling/ npx playwright
  test --project=chromium` passes against the live site, under its real subpath.

### review (Sonnet, high)

Review the whole piece against this spec and `GOALS.md`, independently. In particular:

- every Android component test case has a web twin, or the spec says why not;
- every visible string matches the Kotlin (compare the screens' strings side by side),
  and the web-only strings are the ones listed here;
- `testIds.test.ts` passes, and its exception lists hold only Android-only and web-only
  ids;
- `reviewState.ts` matches `ReviewViewModel` branch for branch, including record-at-
  first-attempt and no records in practice;
- nothing in `web/src` reads `Date.now()`, `Math.random()` or the time zone except
  web-core's `clock.ts` and `random.ts`;
- nothing touches `navigator` outside `browserPlatform.ts` and `main.tsx`'s service
  worker registration;
- the CSP has no `'unsafe-inline'` and no other origin;
- the service worker precaches every built file and nothing else;
- `PRIVACY.md` says what the web app stores and sends;
- the iPhone checklist in `web/README.md` is complete;
- no war-story comments.

High effort: this piece is what iPhone users get, and nobody can test it on an iPhone
in the loop.

Run the full checks: `<web>`, `<smoke>`, the live smoke run (`SMOKE_URL=… npx
playwright test --project=chromium`), `./gradlew testDebugUnitTest lintDebug`,
`node --test 'scripts/*.test.mjs'`, `cd e2e && npm run check-steps -- --all && npm
run typecheck`, and `<ci>` for the final commit (every job green, and the Pages deploy
too). The log says the iPhone check by hand hasn't been done, unless Alan has reported
it. No version bump: the piece is web-only (the decision on releases), and the
`CHANGELOG.md` line ships with the next Android release.

## What later pieces rely on

- **`shared-specs`**:
  - Selectors carry over: every Android test tag the e2e suite uses is a `data-testid`
    with the same value, and the visible text is Android's. A step that finds "Start"
    or `home_practice_count` works on both.
  - Playwright is installed in `web/`, with `playwright.config.ts` (its `webServer`
    and `baseURL`) and the console-error fixture. The Gherkin runner reuses them.
  - `<App container>` takes any repository, clock, fuzz, random and
    `autoAdvanceMillis`, so a test-only entry (not in the production build) can mount
    the app with a test clock and fixed fuzz and expose a seed hook over
    `addWord`/`importBackup`. That is the web's `SeedWordsActivity`, which
    `shared-specs` builds.
  - Steps that differ by platform: the clipboard (Playwright's permission and
    `readText`, as `clipboard.spec.ts` does), import (`setInputFiles` on the hidden
    file input), export (the download event), and anything about notifications
    (Android-only until `web-push`).
- **`web-push`**:
  - Settings gains a "Daily reminder" section above Practice.
  - `sw-template.js` gains `push` and `notificationclick` handlers. A tap opens
    `./#/review`, which starts a session on a fresh load.
  - The push server's origin is added to the CSP's `connect-src`.
  - `PRIVACY.md`'s "The web app" section gains the push paragraph.
  - The Install section already exists, and iOS only allows push for installed apps.
  - The reminder fields go in the `settings` store beside `lastExportedAt`.
  - Home's Today card stays as the in-app "due today".
