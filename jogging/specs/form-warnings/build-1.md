# form-warnings/build-1: the rule on both apps

`formWarnings(word, content)` in Kotlin and TypeScript, golden-tested in a new
`golden/warnings.json` with a runner on each side. No UI: build-2 and build-3 use it.

The piece (`jogging/specs/form-warnings.md`): flag a form that is probably not a real form
of its word, so the user can fix it before review asks for it. A chat AI gave "curious" the
form "most curious"; the reply was valid, and review later asked for a spelling with a space
in it. Warnings never reject, are computed, and are never stored: no schema, migration or
backup change. Scheduling is untouched (goal 4).

## Design

`app/src/main/java/io/github/dontpanic345/tortoisespelling/domain/FormWarnings.kt`:

```kotlin
/** A form that probably isn't a real form of its word: where it is and what to tell the user. */
data class FormWarning(val definition: Int, val form: Int, val message: String)

/**
 * The suspect forms in [content], in content order (definition, then form); empty for a
 * clean word. The base form (definition 0, form 0) is never flagged: saving sets it to [word].
 */
fun formWarnings(word: String, content: WordContent): List<FormWarning>
```

`web/src/domain/formWarnings.ts`:

```ts
export interface FormWarning { definition: number; form: number; message: string }
export function formWarnings(word: string, content: WordContent): FormWarning[]
```

The rule, the only one for now:

- If `word.trim()` contains a whitespace character, return `[]`: a phrase root ("ice cream")
  may have spaced forms ("ice creams").
- Otherwise, for each form other than the base form (definition 0, form 0), take
  `form.text.trim()`; if it contains a whitespace character, flag it with
  `“<trimmed text>” is more than one word. Spelling review asks for one word.`
  (curly quotes U+201C and U+201D).
- Hyphens and apostrophes are not whitespace ("mothers-in-law", "don't" pass). A blank form
  is not flagged (the editor already says "Required").

Whitespace and trimming are Kotlin's: `trim()` and `any(Char::isWhitespace)`. On the web,
trim with `ktTrim` and add `ktHasWhitespace(raw: string): boolean` to
`web/src/domain/text.ts`, next to `ktIsBlank`, testing the existing `KT_WHITESPACE` class
(non-global regex, `u` flag). So a non-breaking space or tab inside a form counts.

Later checks (a label like "superlative" on a two-word form, a duplicate form) will join
this function; keep it one list built in content order.

### Golden

`golden/warnings.json`:

```json
{ "about": "…formWarnings (FormWarnings.kt)…", "formWarnings": [
  { "name": "…", "word": "curious", "content": { "definitions": [ … ] },
    "out": [ { "definition": 0, "form": 1, "message": "“most curious” is more than one word. Spelling review asks for one word." } ] }
] }
```

Content is the shared `WordContent` shape (`golden/README.md`, "Format"); reuse the existing
content parsers in `Golden.kt` and `web/test/golden/load.ts`. Write easy-to-lose characters
as `\uXXXX`. Cases at least:

1. a clean word ("run" with "ran", "running") → `[]`
2. "curious" with "most curious" at definition 0, form 1 → one warning (0, 1, the message)
3. a phrase root "ice cream" with "ice creams" → `[]`
4. "mother-in-law" with "mothers-in-law" → `[]`
5. "do" with "don't" → `[]`
6. spaces around a form (" curiouser ") → `[]`
7. a non-breaking space inside a form (`"most curious"`) → flagged, the message holding the ` `
8. a tab inside a form → flagged
9. a root with a non-breaking space inside is a phrase → `[]`
10. a root with spaces around it (" curious ") is one word → its spaced form is flagged
11. two flagged forms in two definitions → both, in content order
12. a base form whose text has a space, word "curious" → `[]` (the base form is never checked)
13. a blank form → `[]`

Runners: `app/src/test/java/io/github/dontpanic345/tortoisespelling/golden/WarningsGoldenTest.kt`
and `web/test/golden/warnings.test.ts`, written like their neighbours, each with the "has a
runner for every function" check. Add `| \`warnings.json\` | \`formWarnings\` |` to the file
table in `golden/README.md`.

## Tests

The golden cases are the tests. Prove they bite, then revert each change:

- Drop the phrase-root check: case 3 fails on both runners.
- Use JavaScript's `/\s/` in place of `ktHasWhitespace` on the web, and `' ' in text` on
  Android: case 7 or 8 fails on the runner you changed.

Done: `./gradlew testDebugUnitTest lintDebug` and `cd web && npm test && npm run typecheck`.
