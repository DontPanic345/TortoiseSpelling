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
              precache.ts: fills in sw-template.js and emits dist/sw.js
sw-template.js the service worker (cache-first, precaches every built file)
public/       compat.js (the unsupported-browser check), manifest.webmanifest and icons
smoke/        Playwright specs; a console or page error fails any of them
test/         Vitest, mirroring src/ (test/data/ runs the repository on fake-indexeddb)
test/golden/  one runner per golden file, and load.ts
test/ui/      router, test ids (checked against TestTags.kt) and common components; jsdom
test/support/ testClock.ts, seeded.ts
```

`src/domain/` mirrors Android's `domain/` file for file. Clock, fuzz and random are
parameters, so tests pin them. Words are stored in IndexedDB with their content nested; every
repository write is one transaction. Kotlin's whitespace rules are in `text.ts`. See
[`../CLAUDE.md`](../CLAUDE.md) for the rules of the port.

## Smoke tests

`npm run smoke` builds, serves `dist/` and runs `smoke/` in Chromium and WebKit: the
first-run journey, offline use, the manifest and icons, backup import and export, and Copy
prompt (Chromium only). `SMOKE_URL=https://dontpanic345.github.io/TortoiseSpelling/ npx
playwright test --project=chromium` runs it against the live site.

## iPhone check by hand

Playwright's WebKit is not iOS Safari, so after a change to the review screen, the
service worker or the manifest, check on a real iPhone:

1. Install from Safari (Share, Add to Home Screen).
2. It opens standalone with the icon.
3. Add a word with Copy prompt and Paste answer through a chat app.
4. Review it: the keyboard stays up between words, with no autocorrect or suggestions.
5. Export to Files and import it back.
6. In airplane mode, it opens and works.
