# Tortoise Spelling web

A TypeScript port of the Android app's word logic, proved equal to the Kotlin by the golden
cases in [`../golden`](../golden/README.md). There are no screens yet. Requires Node 22.

```bash
npm ci
npm test            # Vitest: the golden runner and the unit tests
npm run typecheck   # tsc --noEmit
```

## Layout

```text
src/domain/   the port, pure TypeScript: no browser API but Intl
src/data/     model types (later: backup, IndexedDB, repository)
test/         Vitest, mirroring src/
test/golden/  one runner per golden file, and load.ts
test/support/ testClock.ts, seeded.ts
```

`src/domain/` mirrors Android's `domain/` file for file. Clock, fuzz and random are
parameters, so tests pin them. Kotlin's whitespace rules are in `text.ts`. See
[`../CLAUDE.md`](../CLAUDE.md) for the rules of the port.
