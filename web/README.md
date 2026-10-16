# Tortoise Spelling web

A TypeScript port of the Android app's word logic, proved equal to the Kotlin by the golden
cases in [`../golden`](../golden/README.md), with the screens being built on top of it in
Preact. Requires Node 22.

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
