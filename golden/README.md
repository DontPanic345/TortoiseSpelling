# Golden cases

Cases shared by the Android app and the web app. Each file is an input and the expected
output for a ported function. A JUnit runner checks them against the Kotlin and a Vitest
runner against the TypeScript, so a case that passes on both proves the two apps compute
the same thing.

| Runner | Where | Run with |
|---|---|---|
| Kotlin | `app/src/test/java/.../golden/` (`Golden.kt` and one `<Area>GoldenTest` per file) | `./gradlew testDebugUnitTest` |
| TypeScript | `web/test/golden/` (`load.ts` and one `<area>.test.ts` per file) | `cd web && npm test` |

The Kotlin runner is the oracle: a case is only right once it passes on the JVM. If the two
runners disagree, the port is wrong, unless the difference is under Known differences.
A change to a rule in `domain/` changes the case and the TypeScript in the same commit.

## Format

`golden/<area>.json` is `{ "about": "<one line>", "<function>": [ cases… ] }`: one array per
ported function. Each case is an object with its inputs by parameter name, the expected
output, and a `name` saying what it checks (the Kotlin test it came from, in words).

- Doubles compare within `1e-9`; everything else compares exactly, after parsing.
- A word in a case lists only the fields it needs. The rest take Kotlin's defaults: `id` 0,
  `text` "cat", `createdAt` 0, the SM-2 starting state, `dueOn` 0, `isNew` **true**.
- Random cases never expect a particular outcome, because Kotlin's `Random(seed)` and a
  JavaScript generator give different sequences. A case gives a range (`within`) or the
  positions that must hold (`freshAt`), and each runner checks seeds `0..49`. `varies`
  means the results must not all be the same; `all` means every value in `within` comes up.
- Every file has a runner test that fails if the file holds a function with no runner, so no
  case sits unread.
- Strings with characters that are easy to lose (non-breaking spaces, the byte order mark,
  control characters) are written as `\uXXXX` escapes.

## Files

| File | Covers |
|---|---|
| `text.json` | `normalizeWord`, Kotlin's `trim()` and `isBlank()` (`ktTrim`, `ktIsBlank`) |
| `blank.json` | `blankWordIn`, `hideWordInDefinition` |
| `diff.json` | `spellingDiff` |
| `sm2.json` | `Sm2Scheduler.next`, `fuzzedDueDay`, the constants and `Grade` |
| `days.json` | `today`, `dayOf` (in `Pacific/Auckland` and `America/Los_Angeles`), `relativeLabel`, `currentStreak` |
| `progress.json` | `learningStage`, `wordProgress`, `WordFilter.matches`, `wordFilterCounts`, `recentDays`, `greeting` |
| `session.json` | `remainingNewToday`, `interleaveSession` |

## Known differences

Where the port deliberately differs from the Kotlin. A case where the runners disagree is a
bug in the port unless it is listed here.

- None yet. (Arriving with the backup format: JSON numbers such as `17.0`, which
  `JSON.parse` reads as `17`, and `Long` keys beyond JavaScript's safe integers.)

## Kotlin's string rules

Kotlin's `trim()`/`isBlank()` and Java's regex `\s` differ from JavaScript's in which
characters count as whitespace. The port's `ktTrim` strips `Char.isWhitespace` characters
(Unicode space, line and paragraph separators, `\t \n \v \f \r` and U+001C to U+001F), and
`normalizeWord` collapses only `[ \t\n\v\f\r]+`. `text.json` pins the traps: a non-breaking
space is trimmed at the ends but not collapsed inside, U+001F is trimmed, and the byte order
mark is not.
