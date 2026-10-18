# Tortoise Spelling web

A TypeScript port of the Android app's word logic, proved equal to the Kotlin by the golden
cases in [`../golden`](../golden/README.md), with Preact screens on top of it, deployed to
<https://dontpanic345.github.io/TortoiseSpelling/> by `.github/workflows/pages.yml`.
Requires Node 22.

```bash
npm ci
npm run dev         # Vite dev server
npm run build       # typecheck, then the production build in dist/ (with the CSP)
npm run preview     # serve dist/ on port 4173
npm run smoke       # Playwright on the production build, in Chromium and WebKit
                    # (npx playwright install --with-deps chromium webkit, once)
npm run specs       # the shared specs (../specs) on the --mode e2e build, in Chromium and WebKit
npm run check-steps # every shared step is defined here and every definition is used
npm run icons       # rasterise ../docs/icon.svg into public/icons/
npm test            # Vitest: the golden runner, the unit tests and the UI tests (jsdom)
npm run typecheck   # tsc --noEmit
```

## Layout

```text
src/domain/   the port, pure TypeScript: no browser API but Intl
src/data/     model types, backup, IndexedDB (db.ts) and the repository
src/ui/       Preact: router, container, platform (the only `navigator` code is
              browserPlatform.ts), test ids, common components, and a `<name>State.ts` per screen
build/        csp.ts: the Content Security Policy added to the production index.html;
              precache.ts: bundles src/sw/sw.ts and emits dist/sw.js
src/sw/       the service worker (cache-first, precaches every built file; push, click and
              subscription-change handlers), typechecked by tsconfig.sw.json
src/push/     the reminder: PushPlatform, the server client, reminderSync and PUSH_SERVER
              (fakes for the e2e build are in src/debug/fakePush*.ts)
public/       compat.js (the unsupported-browser check), manifest.webmanifest and icons
smoke/        Playwright specs; a console or page error fails any of them
steps/        step definitions for the shared specs in ../specs
test/         Vitest, mirroring src/ (test/data/ runs the repository on fake-indexeddb)
test/golden/  one runner per golden file, and load.ts
test/ui/      router, test ids (checked against TestTags.kt) and common components; jsdom
test/support/ testClock.ts, seeded.ts
```

## Rules of the port

- `src/domain/` mirrors Android's `domain/` file for file, same names in camelCase. A rule
  change in Android's `domain/` or `Backup.kt` changes `../golden/` and the TypeScript in the
  same commit. The Kotlin runner is the oracle: a case is right only once it passes on the
  JVM; `../golden/README.md` lists the known differences.
- Kotlin's whitespace rules, not JavaScript's: `ktTrim`/`ktIsBlank` (`text.ts`) wherever the
  Kotlin calls `trim()`/`isBlank()`.
- Clock, fuzz and random are parameters (`createRepository({ db, clock, fuzz, random })`);
  only `clock.ts` and `random.ts` read the real time or `Math.random`. Golden cases never
  expect a particular random outcome.
- Words are one IndexedDB record each, content nested (the backup's tree); queries are pure
  functions over every word (`domain/queries.ts`).
- Every repository write is one `readwrite` transaction that does its checks and re-reads
  inside it, awaiting only that transaction's requests (anything else lets it commit early).
  `updateWord` writes only `text`, `normalizedText` and `content`, so it can't undo
  scheduling; `markShown` stamps the example at the card's position only if its text still
  matches.
- IndexedDB versions (`src/data/db.ts`): every schema change bumps `DB_VERSION`, adds a
  `case` to `upgrade` that migrates existing records and never rewrites an earlier case, and
  adds a test that opens the previous version's database with records in it. No store is
  deleted with its data.
- Nothing in `src` makes a network call except the reminder's calls to `PUSH_SERVER`
  (`src/push/server.ts`; empty hides every reminder control). The production CSP
  (`build/csp.ts`) allows only the app's origin and `PUSH_SERVER`: a new origin is added
  there deliberately, with `../PRIVACY.md` updated.
- UI: `XScreen`/`XContent` and `<name>State.ts` mirror Android's split. Hash routes;
  `back(fallback)` goes back only when the app pushed the entry. The copy is Android's, test
  ids are `TestTags.kt`'s values as `data-testid` (`testIds.test.ts`), and UI rules shared
  with Android live in `../golden/ui.json`.
- The review field is one element, never remounted, with autocorrect off: remounting it
  dismisses the iOS keyboard between words.
- The service worker is bundled into one classic-script `sw.js` by a nested `vite build`
  in `build/precache.ts`, versioned by a hash of the build. What `src/sw/` imports must not
  touch DOM globals (`tsconfig.sw.json` uses the WebWorker lib). Keep `ignoreVary: true` on
  its `caches.match`.
- `main.tsx` calls `settleQuietDays()` before the first render. Home asks for persistent
  storage once there is a word, and nudges to export when storage isn't persistent and no
  export is under 30 days old.
- Safari 16.4 is the minimum; `public/compat.js` shows a message on older browsers.
- The reminder's design is in `../jogging/specs/web-push.md`.

## Smoke tests

`npm run smoke` builds, serves `dist/` and runs `smoke/` in Chromium and WebKit: the
first-run journey, offline use, the manifest and icons, backup import and export, and Copy
prompt (Chromium only). `SMOKE_URL=https://dontpanic345.github.io/TortoiseSpelling/ npx
playwright test --project=chromium` runs it against the live site.

## Shared specs

`npm run specs` runs the Gherkin features in [`../specs`](../specs/README.md) that aren't
tagged `@android`, in Chromium and WebKit (`specs-chromium`, `specs-webkit`), at a phone's
width. `playwright-bdd` turns them into Playwright tests (`.features-gen/`, ignored); the
config is `playwright.specs.config.ts`. They run against `dist-e2e/`, the production build
made with `vite build --mode e2e`: same CSP and service worker, plus `window.__tortoiseSpellingSeed`
(`src/debug/seedHook.ts`), which the Given steps call to add words as `SeedWordsActivity` does
on Android. The production bundle doesn't contain it. A console or page error fails a scenario.

`npm run check-steps` needs no browser: it fails on a feature step with no definition here and
on a definition no feature uses.

```text
steps/*.steps.ts   common, home, review, settings, words, backup, copy_prompt (Android's twins are in ../e2e/step-definitions/)
steps/support/     fixtures.ts (test, Given/When/Then, scenario and downloads), selectors.ts, seed.ts, hooks.ts, screens/
```

Export is a download saved into the test's own `downloads` folder, and import picks a file
from it. The clipboard is read in Chromium; WebKit can't read it under Playwright, so there
the step checks the app's "Prompt copied." message.

## iPhone check by hand

Playwright's WebKit is not iOS Safari, so after a change to the review screen, the
service worker or the manifest, check on a real iPhone:

1. Install from Safari (Share, Add to Home Screen).
2. It opens standalone with the icon.
3. Add a word with Copy prompt and Paste answer through a chat app.
4. Review it: the keyboard stays up between words, with no autocorrect or suggestions.
5. Export to Files and import it back.
6. In airplane mode, it opens and works.
7. Turn on the reminder from Home in the installed app and allow it: "Send a test
   notification" arrives, a reminder arrives at the set time with the right count, tapping
   it opens a session, and turning it off stops them.
