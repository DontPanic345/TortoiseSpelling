# Piece: web-core

The `web/` project, a TypeScript port of the app's word logic proved equal to the Kotlin by
shared golden cases, IndexedDB storage behind a repository with the same rules as
`WordRepository`, and backup JSON that moves both ways between Android and web. No screens:
`web-ui` builds those on top. Source: `docs/testing-and-web-plan.md` ("Web app (PWA)",
"Suggested order" step 3, the "Fuzz" note).

Builds on `drop-api-key` as specified, and through it on `copy-prompt`, `word-forms`,
`test-ui-layers` and `test-data-layer`. This spec assumes the Kotlin as those pieces leave it:

- `Word` with SM-2 state only (no `definition`, `example`, `partOfSpeech`, `autoRefresh`,
  `refreshedOn`); content in `definitions`, `word_forms` and `example_sentences`, loaded as
  `WordWithContent`;
- `domain/WordContent.kt` (`WordContent`, the drafts, `simpleContent`, `preparedFor`,
  `isComplete`, `apply(ContentEdit)`, `searchTerms`, `exampleMissesForm`),
  `domain/CardPick.kt` (`ReviewCard`, `pickCard`), `domain/LookupPrompt.kt`,
  `domain/PastedLookup.kt` (`parsePastedLookup`, `summary`, `isBlank`, `PasteLimits`);
- `Days.today(clock)`, `DeviceClock`, `WordRepository(dao, settings, clock, fuzz)`;
- `Backup.kt` at format version 1, with the `definitions` tree beside the flat root-card
  fields, without `autoRefresh`/`refreshedOn`, and `BackupWord.toImport(): ImportedWord`;
- `Settings` holding `newWordsPerDay`, the reminder fields and `cloudBackupEnabled`.

## What it delivers

- **A `web/` npm project** in TypeScript, with Vitest, a strict typecheck and a CI job.
- **The domain, ported.** Everything in Android's `domain/` that the web app needs, plus
  `normalizeWord`, `Grade` and the backup mapping, as plain TypeScript with no browser API.
- **Golden cases shared by both apps.** A root `golden/` folder of JSON cases, each an
  input and the expected output. A JUnit runner checks them against the Kotlin and a
  Vitest runner against the TypeScript, so a case that passes on both proves the two
  apps compute the same thing. Every deterministic assertion in the Kotlin domain and
  backup tests has a case.
- **IndexedDB storage and a repository**: add, edit, delete and suspend words; today's
  plan, session and practice pool as `ReviewCard`s; recording a review; the streak, the
  week strip and progress; settings; backup export and import. The same rules as
  Android, tested at the repository level with the Kotlin journeys' scenarios.
- **One backup format.** A file exported by either app imports into the other, with
  every word's content and scheduling, and old Android files (0.3.0, flat, with the
  dropped keys) import on the web.

Goals it leans on:

1. **Nothing lost.** The web database starts at version 1 with a written rule for
   upgrades (a version bump, an upgrade step and a test, never a destructive one).
   Import merges and never overwrites an existing word's progress, as on Android. The
   backup golden cases prove files read both ways.
3. **No API key.** Nothing in `web/` makes a network call. There's no client to port.
4. **Scheduling per root word.** SM-2, `Grade`, the allowance, interleaving and
   `recordReview` port as they are, and golden cases pin them to the Kotlin. Content and
   `shownAt` are content only, as on Android.
5. **Two apps that behave the same.** The golden cases are the proof at this layer;
   `shared-specs` adds it at the behaviour layer.
6. **Free to run.** Static code and the browser's own storage.
7. **Simple.** One runtime dependency (`idb`), three dev ones (`typescript`, `vitest`,
   `fake-indexeddb`) plus `@types/node`. No UI framework yet, no ESLint, no path aliases.

### Settled here (the docs and decisions leave these open)

- **Golden cases are data, in `golden/` at the repo root**, not a second hand-written
  copy of each Kotlin test. The Kotlin unit tests stay as they are, as the readable
  statement of intent. Cases are written by hand from them; the Kotlin runner is the
  oracle, so a case is only right once it passes on the JVM.
- **Randomness is a parameter, never compared across platforms.** Kotlin's `Random(seed)`
  and a JavaScript generator give different sequences, so golden cases never expect a
  particular random outcome. For random functions a case gives the set of allowed
  results, and each runner checks 50 seeds (`0..49`): every result is in the set and,
  where the case says `"all": true`, every member of the set comes up.
- **Kotlin's string rules, not JavaScript's.** Kotlin's `trim()`/`isBlank()` and Java's
  regex `\s` differ from JavaScript's in which characters count as whitespace. The port
  has `ktTrim` and `ktIsBlank` and uses them wherever the Kotlin calls `trim()` or
  `isBlank()`. Golden cases cover the differences (below).
- **Words are stored with their content nested**, one IndexedDB record per word, not in
  four normalized stores. Content is always read with its word, an IndexedDB transaction
  makes a read-modify-write atomic, and the record is the backup's tree. The Room tables
  exist for SQL's sake; IndexedDB has no joins to save.
- **Queries are pure functions over all words.** IndexedDB can't index booleans, and a
  word list is hundreds of rows, so the repository reads every word and filters with
  ported versions of the DAO's queries (`dueWords`, `newWords` and the rest), which are
  then unit-testable without a database.
- **An example is addressed by its position**, `(d, f, e)`, not an id. `markShown`
  stamps the example at that position only if its text still matches, so an edit in
  another tab can't stamp the wrong sentence.
- **`updateWord` re-reads inside its transaction.** It takes the id, the new text and the
  new content, and writes only `text`, `normalizedText` and `content` onto the stored
  row. That is Android's "re-read the word at save time" rule made structural.
- **Settings on the web are `newWordsPerDay` and the satisfied days**, in an IndexedDB
  `settings` store. The reminder fields arrive with `web-push`; `cloudBackupEnabled` is
  Android-only.
- **`ReminderTime.kt` and `BackupPolicy.kt` aren't ported.** The first schedules
  WorkManager (`web-push` designs its own timing and ports it if it needs it); the second
  is Android's backup agent.
- **The DAO's SQL queries get TypeScript tests, not golden cases.** They have no pure
  Kotlin twin to run a case against; their cases come from `test-data-layer`'s DAO
  table instead.
- **No version bump, no `CHANGELOG.md` line.** Nothing here reaches a user: the Android
  changes are test-only and the web app has no screens yet (`GOALS.md`, Releases).

## Design

### Project layout

```text
golden/
  README.md            the case format, the runners, the known differences
  text.json  blank.json  diff.json  sm2.json  days.json  progress.json  session.json
  content.json  pick.json  prompt.json  paste.json  backup.json
  backup/              whole backup files the backup cases name
web/
  package.json  package-lock.json  tsconfig.json  vitest.config.ts  README.md
  src/domain/          the port, pure
  src/data/            model types, backup mapping, IndexedDB, repository, settings
  test/                Vitest, mirroring src/
  test/golden/         one runner per golden file, and load.ts
  test/support/        testClock.ts, seeded.ts
```

`web/package.json`: `"private": true`, `"type": "module"`, scripts `"test": "vitest run"`
and `"typecheck": "tsc --noEmit"`. Dependencies pinned with `~` like `e2e/`, at the current
stable versions when build-1 runs: `idb` (runtime); `typescript` (`~7.0.x`, as `e2e/`),
`vitest`, `fake-indexeddb`, `@types/node` (`~22`, matching CI's Node 22). `web-ui` adds the
dev server, the bundler config and the UI framework.

`tsconfig.json`: `strict`, `noUncheckedIndexedAccess`,
`target`/`lib` `ES2022` plus `DOM`, `module` `ESNext`, `moduleResolution` `bundler`,
`noEmit`, `include` `src` and `test`. Relative imports without extensions.

`vitest.config.ts`: `environment: "node"`, `setupFiles` importing `fake-indexeddb/auto`
for the storage tests.

`web/README.md`: what's here, the two commands, the layout above, and a pointer to
`golden/README.md` and `CLAUDE.md`. Short, like `e2e/README.md`'s opening.

### Golden cases

Each `golden/<area>.json` is `{ "about": "<one line>", "<function>": [ cases… ] }`, one
array per ported function, each case an object with the inputs by parameter name, the
expected output, and a `name` saying what it checks (the Kotlin test it came from, in
words). For example:

```json
{
  "about": "SM-2 steps and the due-day fuzz (Srs.kt).",
  "next": [
    { "name": "new word answered correctly is due in one day",
      "prev": { "repetitions": 0, "easeFactor": 2.5, "intervalDays": 0 }, "quality": 5,
      "out": { "repetitions": 1, "easeFactor": 2.6, "intervalDays": 1 } }
  ],
  "fuzzedDueDay": [
    { "name": "short intervals are not fuzzed", "today": 100, "intervalDays": 1, "within": [101, 101] },
    { "name": "long intervals stay within 5%", "today": 1000, "intervalDays": 100, "within": [1095, 1105], "varies": true }
  ]
}
```

Conventions, written up in `golden/README.md`:

- Doubles compare within `1e-9`; everything else compares exactly, after parsing, so
  JSON number formatting (`2.0` against `2`) never matters.
- A `Word` in a case lists only the fields it needs; the rest take Kotlin's defaults
  (`text` "cat", `dueOn` 0, the SM-2 starting state). Both runners share one `wordFrom`
  helper each.
- Content is the `WordContent` shape: `{ "definitions": [ { "text", "partOfSpeech",
  "forms": [ { "text", "label", "examples": [ { "text", "shownAt" } ] } ] } ] }`, blanks as
  `""`, omitted fields defaulted as in Kotlin.
- Random cases use `within` (a range), `oneOf` (a set) and `all`/`varies`, checked over
  seeds `0..49` as above.
- **Known differences** is a section listing behaviour where the port deliberately
  differs, each with the reason. A case where the two runners disagree is a bug in the
  port unless it is listed there. It starts with one entry: JSON numbers. `JSON.parse`
  reads `17.0` as the integer 17, so the web import accepts `"intervalDays": 17.0`, which
  kotlinx refuses; matching it would need a hand-written JSON parser (goal 7), and being
  more lenient can't lose a word (goal 1). A second entry: `Long` keys beyond
  JavaScript's safe integers (±2^53 − 1), which kotlinx reads and the port refuses; no
  real day count or millis comes near that.
- **Clock defaults.** `BackupWord.createdAt` and `BackupFile.exportedAt` default to
  `System.currentTimeMillis()` in Kotlin, so a case can't give their value. Where a file
  leaves one out, the expected value is the string `"now"`, and each runner checks the
  result lies between the millis it read just before and just after the call (the
  TypeScript passes `now` in, so its runner can pin it, but checks the same way).

The files and what they cover. "Every test" means every deterministic assertion in that
Kotlin test class has at least one case.

| File | Kotlin source | Cases |
|---|---|---|
| `text.json` | `NormalizeWordTest`, `Word.kt` | `normalizeWord`, `ktTrim`, `ktIsBlank`: every test, plus the whitespace traps below |
| `blank.json` | `WordBlankTest` | `blankWordIn` (text, didBlank), `hideWordInDefinition`: every test, plus "café"/"CAFÉ" and a word between apostrophes |
| `diff.json` | `SpellingDiffTest` | `spellingDiff` (`firstDivergence`, `matches`, `correctPrefixLength`): every test, plus "İstanbul" against "istanbul" (matches) |
| `sm2.json` | `SrsTest` | `next` (single steps and sequences of qualities), `fuzzedDueDay` (`within`, `varies`), the constants |
| `days.json` | `DaysTest`, `test-ui-layers`' `today(clock)` test | `relativeLabel`, `currentStreak`, `dayOf` with a zone either side of midnight in `Pacific/Auckland` and `America/Los_Angeles` |
| `progress.json` | `ProgressTest` | `learningStage`, `wordProgress`, `WordFilter.matches`, `wordFilterCounts`, `recentDays`, `greeting`: every test |
| `session.json` | `SessionBuilderTest` | `remainingNewToday`; `interleaveSession` over seeds: the result is a permutation of the input, and with 9 due and 3 new words the new ones sit at indexes 2, 5 and 9 (0-based) for every seed (only which word goes where is random) |
| `content.json` | `WordContentTest` | `simpleContent`, `preparedFor`, `isComplete`, `apply` (edits as `{ "edit": "AddForm", "d": 0 }`), `searchTerms`, `exampleMissesForm`: every test |
| `pick.json` | `CardPickTest` | `pickCard`: deterministic picks as one-member `oneOf`, ties with `all`; `answer` and `hint` |
| `prompt.json` | `LookupPromptTest` | `lookupPrompt` for "necessary" and for a word with a quote mark: the whole text |
| `paste.json` | `PastedLookupTest` | `parsePastedLookup` (every message in the table, its order rules, each limit at and one over, a fence, a line of prose, a trailing comma, an emoji counting two units), `summary`, `isBlank` |
| `backup.json` | `BackupTest` | parsing files in `golden/backup/`, the import mapping, the export mapping, and the refusals |

The whitespace traps in `text.json`, each with Kotlin's output as the expected value:
`" Cat "` (Kotlin trims NBSP), `"a  b"` (Java's `\s` doesn't match NBSP,
so it isn't collapsed), `"\u001Fcat"` (Kotlin trims U+001F, JavaScript's `trim()` doesn't),
`"﻿cat"` (JavaScript's `trim()` strips the BOM, Kotlin's doesn't), `"a\t\n b"`.
`ktTrim` strips `[\p{Zs}\p{Zl}\p{Zp}\t\n\v\f\r\u001C-\u001F]` from both ends (Kotlin's
`Char.isWhitespace`), and `normalizeWord` collapses only `[ \t\n\v\f\r]+` (Java's `\s`).
If the JVM disagrees with any expected value here, the JVM is right: fix the case and the
TypeScript.

**The Kotlin runner.** `app/src/test/java/io/github/dontpanic345/tortoisespelling/golden/`:
`Golden.kt` (loads `golden/<name>.json` as a `JsonObject` from the directory in the
`golden.dir` system property, and holds `wordFrom`, `contentFrom` and the double
comparison) and one JUnit class per file (`TextGoldenTest`, …), each with one `@Test` per
function that loops over its cases and names the failing case in the message. JSON is
read with `kotlinx-serialization-json`'s `JsonElement`, already a dependency. The cases
build Room's `WordWithContent` (ids and `orderIndex` from list positions, blanks to null)
where a Kotlin function takes one. In `app/build.gradle.kts`:

```kotlin
tasks.withType<Test>().configureEach {
    val golden = rootProject.layout.projectDirectory.dir("golden")
    systemProperty("golden.dir", golden.asFile.absolutePath)
    // A changed case must rerun the tests, not leave the task UP-TO-DATE.
    inputs.dir(golden).withPathSensitivity(PathSensitivity.RELATIVE)
}
```

**The TypeScript runner.** `web/test/golden/load.ts` reads `../../../golden/<name>.json`
relative to `import.meta.url` with `node:fs`, and holds the same helpers. One
`<area>.test.ts` per file, using `describe.each`/`it.each` with the case `name` as the
title, so a failure reads as the Kotlin test it came from.

### The domain port (`web/src/domain/`)

One file per Kotlin file, same names in camelCase, same function names and parameters
(Kotlin defaults become optional parameters). Comments are the Kotlin KDoc where it
still applies, shortened; no new reasoning in comments.

| File | Ports |
|---|---|
| `text.ts` | `ktTrim`, `ktIsBlank`, `normalizeWord` |
| `random.ts` | `type Random = () => number` (as `Math.random`), `mathRandom`, `nextInt(random, from, until)`, `shuffled(list, random)` (Fisher–Yates) |
| `clock.ts` | `interface Clock { millis(): number; timeZone(): string }`; `deviceClock` (`Date.now()` and `Intl.DateTimeFormat().resolvedOptions().timeZone`, read on every call so it follows a zone change, like `DeviceClock`) |
| `days.ts` | `today(clock)`, `dayOf(millis, timeZone)`, `hourOf(clock)`, `relativeLabel`, `currentStreak` |
| `srs.ts` | `SrsState`, `NEW_WORD_STATE`, `MAX_INTERVAL_DAYS`, `RESET_BELOW_QUALITY`, `Scheduler`, `sm2Scheduler`, `fuzzedDueDay(today, intervalDays, random?)`, `Grade` |
| `session.ts` | `interleaveSession(due, fresh, random?)`, `remainingNewToday` |
| `queries.ts` | The DAO's queries over `Word[]`: `dueWords(words, today)` (unsuspended, not new, `dueOn <= today`, by `dueOn`), `dueCount`, `newWords(words, limit)` (unsuspended new words by `createdAt` then `id`), `availableNewCount`, `introducedOn(words, day)`, `nextDueDay`, `randomWords(words, limit, random)` (unsuspended), `firstCreatedAt`, `recentStudyDays(logs, limit)` (distinct, newest first) |
| `progress.ts` | `KNOWN_INTERVAL_DAYS`, `WordProgress`, `learningStage`, `wordProgress`, `WordFilter` (with labels), `matches`, `wordFilterCounts`, `DayMark`, `recentDays`, `greeting` |
| `spellingDiff.ts` | `spellingDiff` (per UTF-16 unit, as Kotlin's `Char`). Kotlin's `lowercaseChar()` is the one-unit simple mapping; JavaScript's `toLowerCase()` is the full one, which differs only for U+0130 "İ" (to "i" plus a combining dot), so the port lowercases a unit with `c === "\u0130" ? "i" : c.toLowerCase()` |
| `wordBlank.ts` | `BLANK_PLACEHOLDER`, `blankWordIn`, `hideWordInDefinition`: `new RegExp("(?<![\\p{L}\\p{N}])" + escaped + "(?![\\p{L}\\p{N}])", "giu")`, with every regex metacharacter escaped |
| `wordContent.ts` | The four draft types, `ContentEdit` (a discriminated union on `edit`), and every function `word-forms` lists |
| `cardPick.ts` | `ReviewCard` (`word`, `definition`, `partOfSpeech`, `form`, `label`, `example: { text, shownAt, d, f, e } \| null`, `answer`, `hint`) and `pickCard(word, content, random?)` |
| `lookupPrompt.ts` | `lookupPrompt(word)`, the text byte for byte |
| `pastedLookup.ts` | `PastedLookup` (`{ kind: "valid", word, content, renames } \| { kind: "invalid", message }`), `parsePastedLookup`, `summary`, `isBlank`, `PASTE_LIMITS` |

`days.ts`'s `dayOf` gets the local date from `Intl.DateTimeFormat("en-US", { timeZone,
year: "numeric", month: "numeric", day: "numeric" }).formatToParts`, one cached formatter
per zone, and returns `Date.UTC(y, m - 1, d) / 86_400_000`. That is `LocalDate.toEpochDay()`
for the clock's zone, with no dependence on the machine's own zone, so tests pin zones as
the Kotlin does.

`wordBlank.ts` needs regex lookbehind, which Safari has had since 16.4, the same release
that brought Web Push to Home Screen apps; `web-ui` states 16.4 as the minimum.

`pastedLookup.ts` parses with `JSON.parse`. kotlinx's default `Json` is looser in two ways:
it reads a raw control character (a newline) inside a string, which the port matches by
escaping those before parsing, and it reads bare words and odd numbers (`abc`, `01`, `+1`,
`'x'`) as values, which the port doesn't match (a "Known differences" entry in
`golden/README.md`: it would need a hand-written parser). A value of the wrong JSON type
counts as missing, as in the Kotlin. Lengths are UTF-16 units on both platforms.

### Data model and backup (`web/src/data/`)

`model.ts`:

```ts
export interface Word {
  id: number; text: string; normalizedText: string; createdAt: number;
  repetitions: number; easeFactor: number; intervalDays: number; dueOn: number;
  lapses: number; lastReviewedAt: number | null; firstReviewedOn: number | null;
  isNew: boolean; suspended: boolean;
}
export interface StoredWord extends Word { content: WordContent }   // content as preparedFor left it
export interface ReviewLog {
  id: number; wordId: number; reviewedAt: number; reviewedOn: number;
  grade: number; correct: boolean; typedAnswer: string;
}
```

Same units as Android: `dueOn`, `firstReviewedOn` and `reviewedOn` are epoch days; every
`…At` is millis.

`backup.ts`, the format `Backup.kt` writes after `drop-api-key`:

```text
{ "version": 1, "exportedAt": <millis>, "words": [ {
    "text", "definition", "example", "partOfSpeech": string|null, "createdAt",
    "repetitions", "easeFactor", "intervalDays", "dueOn", "lapses",
    "lastReviewedAt": number|null, "firstReviewedOn": number|null, "isNew", "suspended",
    "definitions": [ { "text", "partOfSpeech": string|null,
      "forms": [ { "text", "label": string|null,
        "examples": [ { "text", "shownAt": number|null } ] } ] } ] } ] }
```

- `CURRENT_VERSION = 1`. `exportBackup(words: StoredWord[], exportedAt): string` writes
  every key in this order, with `JSON.stringify(…, null, 4)` (kotlinx's pretty print
  indent), blank part of speech and label as `null`, and the flat fields from the root
  card as `toBackup()` does.
- `parseBackup(text, now): BackupFile` validates as kotlinx decodes: `words` required;
  each word's `text`, `definition` and `dueOn` required; every other key optional with
  Kotlin's default (`exportedAt` and `createdAt` default to `now`, nothing in it reads
  `Date.now()`); a value of the wrong
  type, a `null` for a non-nullable key, or a non-integer or out-of-range integer
  (`Int` keys within 32 bits, `Long` keys safe integers) throws `BackupFormatError("That
  file isn't a Tortoise Spelling backup.")`; `version > 1` throws "That backup was made by
  a newer version of Tortoise Spelling (v*n*)."; unknown keys, including `autoRefresh`
  and `refreshedOn`, are ignored. The same checks apply inside `definitions`.
- `toImport(backupWord): ImportedWord` (`{ word: Omit<Word, "id">, content }`): `text`
  trimmed with `ktTrim`, `normalizedText` rebuilt, the tree when `definitions` isn't
  empty, otherwise `simpleContent` from the flat fields.

`golden/backup/` holds whole files, and `backup.json`'s cases name them:

- `android-0.3.0.json`: flat words as 0.3.0 wrote them, with `autoRefresh` and
  `refreshedOn`, one word with `partOfSpeech` `""` and one with no example. Written to
  match today's `Backup.kt` output exactly (git history has it if `drop-api-key` has run).
- `android-tree.json`: three words with trees (several definitions, a "ran"-style form
  with a label, `shownAt` set and null), easeFactors like 2.36 and 1.3, a suspended word.
- `minimal.json`: the shortest legal file (`{"words":[{"text":"cat","definition":"An
  animal.","dueOn":3}]}`).

For each file a case gives `imported` (the `toImport` result for every word) and
`exported` (what exporting those imported words, with their content through
`preparedFor`, writes as `words`, compared as parsed JSON). The Kotlin runner builds each
`WordWithContent` from the imported word and calls `toBackup()`; the TypeScript calls
`exportBackup`. A file written by either app is therefore read the same way by both,
and both write the same thing back. Refusal cases are inline strings: not JSON, `version`
99, no `words`, a word with no `dueOn`, `"text": 5`, `"isNew": "yes"`, `"dueOn": null`,
and a tree form with no `text`, each with the message. Two more go in as whatever the
JVM does, accepted or refused: a quoted number (`"dueOn": "3"`) and a quoted boolean
(`"isNew": "true"`). kotlinx's lexer takes quoted numbers even with `isLenient` off, so
the first is likely accepted, and the port then accepts a string that is exactly an
integer literal for a number key. Before a refusal case is kept, the
Kotlin runner must refuse it; anything kotlinx accepts that the port refuses (or the
other way round) goes to "Known differences" only if matching it needs a hand-written
parser.

### Storage (`web/src/data/db.ts`)

`idb`'s `openDB<TortoiseSpellingSchema>(name, DB_VERSION, { upgrade })`, `DB_VERSION = 1`,
default name `"tortoisespelling"` (tests pass a fresh name each). Stores:

| Store | Key | Indexes | Holds |
|---|---|---|---|
| `words` | `id`, auto-increment | `normalizedText` (unique) | `StoredWord` |
| `reviewLog` | `id`, auto-increment | `wordId` | `ReviewLog` |
| `settings` | out-of-line, the setting's name | | `newWordsPerDay: number`, `satisfiedDays: number[]` |

`upgrade(db, oldVersion)` is a `switch` on `oldVersion` falling through from `case 0`,
so a later version adds a `case 1` and never rewrites an earlier one. A KDoc-style comment
on `DB_VERSION` says the rule: every schema change bumps it, adds a case that migrates
existing records, and adds a test that opens the previous version's database with
records in it; no store is ever deleted with its data. On `versionchange` (another tab
upgrading) the connection closes itself.

### Repository (`web/src/data/repository.ts`)

`createRepository({ db, clock = deviceClock, fuzz = (today, days) => fuzzedDueDay(today,
days), random = mathRandom })`, the same injection as `test-ui-layers`' `WordRepository`.
Every method is `async`, and every method that writes does so in one `readwrite`
transaction over the stores it touches, its checks (duplicates, re-reads) included,
then tells subscribers. Inside a transaction, await only that transaction's requests:
an IndexedDB transaction commits as soon as it has nothing pending, so awaiting anything
else first makes its next request throw `TransactionInactiveError`. Read the clock and
compute `today` before opening it.

| Method | Behaviour (Kotlin counterpart) |
|---|---|
| `subscribe(listener): () => void` | `listener()` after every write in this tab. What `Flow` gives the Android screens; `web-ui` decides how screens use it. |
| `wordCount()`, `wordById(id)` | As the DAO. |
| `wordsWithContent()` | Every `StoredWord`, newest `createdAt` first (`observeWordsWithContent`). |
| `addWord(text, content)` | `{ kind: "blank" }` for a blank word; `{ kind: "duplicate", existing }` if the normalized text exists; else stores `createdAt = clock.millis()`, `dueOn = today`, the SM-2 starting state and `content.preparedFor(trimmed)`, and returns `{ kind: "added", id }`. |
| `updateWord(id, text, content)` | In one transaction: the duplicate check against other ids, then a re-read of the row, writing only `text`, `normalizedText` and `preparedFor`'s content. Returns `"updated"` or the duplicate. |
| `deleteWord(id)` | The word and its review log rows, in one transaction (Room's cascade). |
| `setSuspended(id, suspended)` | Only that field. |
| `todayPlan()` | `{ dueCount, newCount }` as `WordRepository.todayPlan`. |
| `buildSession()` | `dueWords`, the allowance from `settings.newWordsPerDay` and `introducedOn(today)`, `newWords`, `interleaveSession(due, fresh, random)`, then `pickCard` per word. |
| `practicePool(limit = 10)` | `randomWords`, then `pickCard`. Writes nothing. |
| `markShown(card)` | Stamps `clock.millis()` on the card's example if its position still holds that text; no-op for a card without one. The only write besides an edit that touches `shownAt`. |
| `recordReview(wordId, correctFirstTry, typedAnswer)` | As Kotlin's: quality 5 or 2, `sm2Scheduler.next`, `dueOn = fuzz(today, interval)`, lapses, `lastReviewedAt`, `firstReviewedOn ?? today`, `isNew = false`, and one log row with the answer `ktTrim`med, reading the current row inside the transaction. A word deleted meanwhile (in another tab) records nothing. |
| `reviewedToday()`, `currentStreak()`, `lastWeek()`, `progress()`, `nextDueDay()` | As Kotlin's, with the 400-day study-day window and the 7-day week; `lastWeek` takes `firstDay` from `dayOf(firstCreatedAt, clock.timeZone())`. |
| `markTodaySatisfied()` | Adds today to `satisfiedDays`, keeping only days `> today - 400` (`SettingsStore.markSatisfied`). |
| `settings()`, `setNewWordsPerDay(n)` | Default 10, stored clamped to 1..100. |
| `exportBackup()` | `exportBackup(every word oldest first, clock.millis())`. |
| `importBackup(text)` | `parseBackup`, then in one transaction, in file order: skip a word whose normalized text is blank or already stored (including earlier in the same file), otherwise store `toImport`'s word with `preparedFor`'s content. Returns `{ added, skipped }`. Throws `BackupFormatError` with nothing written. |

## Build steps

Each step follows `CLAUDE.md`'s Workflow and `PROTOCOL.md`. None of them changes the APK
(the Android changes are test sources and test-task configuration), so there is no e2e
run, no device and no emulator. "Passing" means every command exits 0. `<web>` is
`cd web && npm ci && npm run typecheck && npm test`.

### build-1: the project, the golden runners, and the scheduling port (Sonnet, high)

`web/` as under "Project layout"; the CI job and the Dependabot entry; `golden/README.md`
and the two runners' shared helpers; the Gradle wiring; then `text`, `random`, `clock`,
`days`, `srs`, `session`, `queries`, `progress`, `spellingDiff` and `wordBlank`, with
`text.json`, `blank.json`, `diff.json`, `sm2.json`, `days.json`, `progress.json` and
`session.json` and their runners on both sides. High effort: it sets up two test
harnesses and the CI job every later step relies on.

- `.github/workflows/ci.yml` gains a `web` job, "Web unit tests and typecheck": checkout,
  `actions/setup-node@v7` with Node 22, `cache: npm` and
  `cache-dependency-path: web/package-lock.json`,
  `npm ci`, `npm run typecheck`, `npm test`, all with `working-directory: web`. The header
  comment mentions it. `release.yml` calls `ci.yml`, so a release now also needs the web
  tests and the golden cases green; that is intended (goal 5).
- `.github/dependabot.yml`: an `npm` entry for `/web` like `/e2e`'s, with a
  `web-minor-and-patch` group and the same `@types/node` major ignore and comment.
- `test/support/testClock.ts`: `testClock(start = Date.UTC(2026, 2, 2, 9))` in `"UTC"`
  (`test-ui-layers`' Monday 09:00), with `advanceDays(n)` and `nextDay()`.
  `test/support/seeded.ts`: `seeded(seed): Random` (mulberry32, a few lines).
- `test/domain/queries.test.ts`: `test-data-layer`'s DAO table rows for the queries
  (`dueWords`/`dueCount`, `newWords`/`availableNewCount`, `introducedOn`, `nextDueDay`,
  `randomWords`, `firstCreatedAt`, `recentStudyDays`), one test each.

Acceptance:

```bash
<web>                                                   # every golden runner and queries.test.ts pass
./gradlew testDebugUnitTest lintDebug                   # the Kotlin golden runners pass with the rest
```

- `app/build/test-results/testDebugUnitTest/` has a `TEST-…golden.<File>GoldenTest.xml`
  for each of the seven golden files, each with `skipped="0"`.

- Temporarily change one expected value in `sm2.json` (`6` to `5` in the second-review
  case): `<web>` and `./gradlew testDebugUnitTest --tests '*Sm2GoldenTest'` both fail,
  and the Gradle run is not UP-TO-DATE. Revert.
- Temporarily make `normalizeWord` use JavaScript's `\s`: `text.json`'s NBSP case fails.
  Temporarily change `ktTrim` to `trim()`: the U+001F case fails. Revert both.
- Push and check the CI run for the commit: the `web` job is green.

### build-2: content, card picking, the prompt and the paste parser (Sonnet, high)

`wordContent`, `cardPick`, `lookupPrompt` and `pastedLookup`, with `content.json`,
`pick.json`, `prompt.json` and `paste.json` and their runners on both sides. High effort:
the paste parser's first-failure order and limits are a contract `web-ui` shows the user
word for word, and the order rules are easy to get subtly wrong.

Acceptance:

```bash
<web>
./gradlew testDebugUnitTest lintDebug
```

- Temporarily let `RemoveForm` remove the base form in the TypeScript: a `content.json`
  case fails on the web side only. Temporarily check limits before the per-definition
  pass: a `paste.json` order case fails. Temporarily make `pickCard` always take the
  first candidate: a `pick.json` tie case fails (its `all`). Revert all three.

### build-3: the backup format (Sonnet, medium)

`model.ts`, `backup.ts`, `golden/backup/`, `backup.json` and both runners, under "Data
model and backup". Settle every refusal case against the Kotlin runner first.

Acceptance:

```bash
<web>
./gradlew testDebugUnitTest lintDebug
```

- Temporarily make the TypeScript `toImport` ignore `definitions`: the `android-tree.json`
  case fails. Temporarily drop `"partOfSpeech": null` from the TypeScript export: the
  `exported` comparison fails. Revert both.

### build-4: IndexedDB storage, the repository, and the docs (Sonnet, high)

`db.ts`, `repository.ts` and settings, under "Storage" and "Repository", and the docs.
High effort: transactions are where a web port can lose a review or a word.

Tests (`web/test/data/`, `fake-indexeddb`, a fresh database name per test, `testClock`,
`fuzz = (today, days) => today + days`):

- `db.test.ts`: opening creates the three stores and the unique index; a second
  `addWord` that differs only in case and spacing is a duplicate.
- `repository.test.ts`, ported from `test-data-layer`'s repository tests and
  `word-forms`' additions: `addWord` trims, rejects blanks and duplicates, scrubs a
  form's text out of a definition; `updateWord` renaming onto another word changes
  nothing, a rename renames the base form, and an update keeps scheduling and `shownAt`;
  `deleteWord` takes its log rows and no one else's; `importBackup` adds, skips blanks,
  duplicates and repeats within the file, leaves an existing word's scheduling exactly as
  it was, and writes nothing for a refused file; `markShown` stamps one example and
  ignores a card whose example text has changed; `recordReview` for a deleted word
  writes no log row.
- `journeys.test.ts`, the five `test-ui-layers` journeys and `word-forms`' rotation
  journey at the repository level (no UI): *scheduling* (add on day D; correct; `dueOn`
  D+1, repetitions 1; `nextDay()`; correct; `dueOn` D+7, two correct log rows); *lapse*
  (a word at repetitions 2, interval 6, due D; wrong: repetitions 0, lapses 1, `dueOn`
  D+1, one log row with `correct` false and the typed answer); *practice* (finish the
  session; `practicePool` and `markShown` leave every scheduling field and the log count
  unchanged); *allowance* (`setNewWordsPerDay(2)`, three words: plan 2 new; review both;
  `nextDay()`: plan 3, 1 new); *streak* (review D and D+1; on D+2 `markTodaySatisfied()`,
  streak 2; on D+3 still 2); *rotation* (two examples, one shown a week ago: day D's
  session shows the other; `nextDay()` shows the first).
- An export from one repository imported into a fresh one gives equal words and
  content (ids aside).

Docs:

- `CLAUDE.md`:
  - The opening paragraph: the repo also holds a web app in `web/` (TypeScript), sharing
    golden cases with the Android app; screens arrive with `web-ui`.
  - Commands: `cd web && npm test` and `npm run typecheck`, and the Gradle golden note.
  - The layers table: "Web unit tests | `web/test/` | Node, no browser" and "Golden
    cases | `golden/` | both: JUnit and Vitest".
  - CI bullet: the `web` job, and that releases wait for it.
  - Architecture, a new "**Web app** (`web/`)" section: the domain port mirrors
    `domain/` file for file; **a change to a rule in `domain/` or `Backup.kt` changes
    `golden/` and the TypeScript in the same commit**, and the Kotlin runner is the
    oracle; Kotlin's whitespace rules via `ktTrim`; clock, fuzz and random are parameters;
    words are stored with their content nested, queries are pure functions; the IndexedDB
    version rule; `updateWord` and `markShown` as settled above.
  - "Secrets and data safety": backups are the same JSON on both apps, and a backup
    format change needs a `golden/backup/` case.
- `web/README.md` and `golden/README.md` as above.
- `docs/testing-and-web-plan.md`: the status line says the web core is built; the
  porting table's Room row says `idb` and the backup row drops "(needs checking)" and
  points at `golden/backup/`; the Vitest assumption loses **(unverified)**; "Open
  questions" marks `web/` in this repo and the shared backup as decided.
- No `README.md`, `PRIVACY.md` or `CHANGELOG.md` change: nothing ships to a user yet.

Acceptance:

```bash
<web>                                                   # db, repository and journey tests pass
./gradlew testDebugUnitTest lintDebug
! grep -rnE "fetch\(|XMLHttpRequest|WebSocket|EventSource" web/src   # goal 3: prints nothing
```

- Temporarily drop the `dueOn` write from `recordReview`: the scheduling journey fails.
  Temporarily skip `markTodaySatisfied`'s write: the streak journey fails. Temporarily
  make `importBackup` overwrite an existing word: its repository test fails. Revert all
  three.

### review (Sonnet, high)

Review the whole piece against this spec and `GOALS.md`, independently. In particular:
every deterministic `@Test` in `NormalizeWordTest`, `WordBlankTest`, `SpellingDiffTest`,
`SrsTest`, `DaysTest`, `ProgressTest`, `SessionBuilderTest`, `WordContentTest`,
`CardPickTest`, `LookupPromptTest`, `PastedLookupTest` and `BackupTest` has a golden case
(list any that don't and add them); both runners load every case of every file (a case
that neither runner reads proves nothing: count them); no golden expectation was bent to
fit the TypeScript where the JVM disagreed; "Known differences" holds only what it should;
`recordReview` and the session match the Kotlin line for line in what they write; every
write is one transaction; the IndexedDB version rule is written down; nothing in `web/src`
reads `Date.now()`, `Math.random()` or the time zone except `clock.ts` and `random.ts`;
no network call; the docs say what the code does. High effort: this piece is where the
two apps' rules are proved equal, and a gap in the golden cases is invisible until the
apps diverge.

Run the full checks: `<web>`, `./gradlew testDebugUnitTest lintDebug`, `node --test
'scripts/*.test.mjs'`, and the CI run for the final commit (all jobs green). No version
bump: the piece is test-only on Android and has no web screens.

## What later pieces rely on

- **`web-ui`**: builds the screens on `createRepository` and the domain port, picking the
  UI framework and adding the dev server, the production build and GitHub Pages' base
  path to `web/`. It ports the UI-state helpers (`statusLabel`, `filterRows`, the
  completion headline, `blankedExample`, `canSave`, `applying`) with new golden files in
  the same format, and uses `subscribe` to refresh screens. Export is a download of
  `exportBackup()`; import reads a chosen file into `importBackup()` and shows the
  `BackupFormatError` message as Android does. It asks for `navigator.storage.persist()`
  and makes export prominent, since browser storage is less durable. It updates
  `PRIVACY.md` for the web app's local storage, and states Safari 16.4 as the minimum.
- **`shared-specs`**: the web seed hook can call `addWord`/`importBackup` on the
  repository; the test clock and fixed fuzz make the web runs deterministic like the
  Android integration tests.
- **`web-push`**: adds the reminder fields to the `settings` store (no `DB_VERSION` bump
  is needed for a new key in an existing store, but a new store is a bump with an
  upgrade case and test). It reads due dates through `nextDueDay` and the queries,
  never sending words. If it needs `millisUntilNext`, it ports it with a `golden/` file
  from `ReminderTimeTest`.
- **Any later Android change** to a ported rule or the backup format updates `golden/`
  and the TypeScript in the same commit, or CI fails on whichever side is behind.
