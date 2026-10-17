# Piece: copy-prompt

Copy prompt and paste-back JSON lookup on the add/edit screen, replacing **Look up with
Claude**. Sources: `docs/copy-prompt-lookup.md` (the round trip, the JSON shape, the
validation list) and `docs/word-forms.md` (the tree the paste fills).

Builds on `word-forms` as specified, and through it on `test-ui-layers`. This spec
assumes: `domain/WordContent.kt` (`WordContent`, `DefinitionDraft`, `FormDraft`,
`ExampleDraft`, `preparedFor`, `isComplete`, `exampleMissesForm`); `AddWordUiState.content`
and `AddWordViewModel.onEdit`; the `AddWordScreen`/`AddWordContent` split with its
component, accessibility and screenshot states; `AddWordContentTest`; the
`addWord*` test tags.

## What it delivers

- **Copy prompt.** A button beside the word field puts a ready-made prompt on the
  clipboard: the word, the exact JSON shape, and the rules the app will check.
- **Paste answer.** A second button opens a dialog with one text field. The user pastes
  the chat AI's reply; the app validates it as they paste and shows either what's wrong
  or a summary ("2 definitions, 4 forms, 4 example sentences"). **Use this** replaces
  the editor's word and content; **Cancel** leaves everything as it was. The user then
  edits anything by hand and saves as usual.
- **Look up with Claude goes** from the add/edit screen, with its API-key hint. The
  API key now only powers "Keep this card fresh", which `drop-api-key` removes.

Goals it leans on:

1. **Nothing lost.** No schema or backup change. Pasting onto an existing word goes
   through the editor and `updateWord`, which keeps scheduling (the decision on editing).
3. **No API key.** The lookup is the copy-prompt round trip; the app sends nothing.
   `ClaudeClient.lookup` stays only because `CardRefresher` calls it until
   `drop-api-key`.
4. **Scheduling per root word.** Untouched: the paste only fills content.
5. **Two apps.** The prompt and the paste parser are pure Kotlin in `domain/`, with exact
   message strings, so `web-core` ports them with golden tests and the web app behaves
   the same.
7. **Simple.** No new dependency: parsing uses `kotlinx-serialization-json`, already in
   the app, through `JsonElement` rather than `@Serializable` classes, so each failure
   gets its own plain message.

### Settled here (the docs leave these open)

- **Auto-refresh** was the doc's "decide this first". `GOALS.md` settles it: it goes, in
  `drop-api-key`. Until then it keeps working through `ClaudeClient` as `word-forms` left it.
- **The JSON is located, not repaired.** The parser takes the text from the first `{` to
  the last `}`. That strips a code fence, as the doc asks, and also a line of prose such
  as "Here's the JSON:", which chat apps add often enough to matter. Nothing inside the
  braces is repaired, with one exception: a backslash before `[`, `]`, `_`, `*`, `#` or a
  backtick is removed. ChatGPT's copy button can put those in (`\[` for `[`), and JSON has
  no such escape, so they are markdown, never part of the answer. `\\` is left alone.
- **Validate as you paste, no separate Check button.** A paste is one change, so the
  result is there at once; the summary is the doc's "preview", and Use this / Cancel are
  its "save or cancel".
- **A word mismatch is confirmed in the dialog, not refused.** If the answer's `word`
  differs from the typed word (normalised), the dialog says so and Use this adopts the
  answer's spelling. That keeps the old lookup's spelling correction ("recieve" →
  "receive") and is the doc's "asked to confirm".
- **Paste is enabled with a blank word field.** The answer's `word` fills it.
- **A bad example rejects the paste.** The doc says reject, and the message names the
  sentence and the form, so the user can ask the chat to fix it. Dropping it silently
  would leave a form the review can't blank.
- **The base form is moved first.** In the first definition, the first form whose
  normalised text equals the answer's `word` moves to position 0; if there is none, a
  base form with that text and no examples is put first. `preparedFor` takes the base
  form by position and overwrites its text, so this must happen before it (`word-forms`,
  "What later pieces rely on").
- **The prompt doesn't force a spelling variety.** It asks to keep the word's own
  British or American spelling unless it's misspelled. Forcing NZ spelling would "correct"
  a deliberate American word.
- **"Prompt copied." shows only below Android 13.** Android 13 and later show their own
  clipboard confirmation, and Android's guidance is not to duplicate it. The help text
  under the buttons explains the round trip either way.
- **Settings' "Claude lookup" section** stays (it is `drop-api-key`'s to remove), but its
  title and help text say the key is now only for keeping cards fresh, so a release
  between the two pieces doesn't point at a button that's gone.

## Design

### The prompt (pure)

`domain/LookupPrompt.kt`:

```kotlin
/** The prompt Copy prompt puts on the clipboard, for any chat AI. */
fun lookupPrompt(word: String): String
```

The text, with `$word` the trimmed word. It is the contract with the parser and the
web app, so it is written exactly as here:

```text
I'm learning to spell "$word". Write flashcard content for it.

Reply with only a JSON object, no other text, in exactly this shape:

{"word": "...", "definitions": [{"text": "...", "partOfSpeech": "...", "forms": [{"text": "...", "label": "...", "examples": ["..."]}]}]}

Rules:
- "word": "$word", spelled correctly. If it's misspelled, fix it. Otherwise keep it exactly as given, including British or American spelling.
- "definitions": the word's main meanings, most common first, usually one to three. Each "text" is a short dictionary-style definition, under 25 words, that doesn't use the word or any form of it.
- "partOfSpeech": noun, verb, adjective and so on.
- "forms": the common forms of the word for that meaning, such as plurals and verb tenses. The first form of the first definition is the word itself. "label" says which form it is, such as "plural" or "past tense".
- "examples": one or two natural sentences for each form. Each one must contain that form's "text" exactly, letter for letter, as a whole word.
- Use plain, everyday language that a learner would know, in the definitions and the example sentences.
- About a dozen forms and sentences in total is plenty.
```

### Parsing and validation (pure)

`domain/PastedLookup.kt`:

```kotlin
sealed interface PastedLookup {
    /** [word] is the answer's spelling; [renames] is true when it differs from the typed word. */
    data class Valid(val word: String, val content: WordContent, val renames: Boolean) : PastedLookup
    data class Invalid(val message: String) : PastedLookup
}

fun parsePastedLookup(text: String, typedWord: String): PastedLookup

/** "2 definitions, 4 forms, 4 example sentences", singular for 1. */
fun WordContent.summary(): String

/** True when every definition, part of speech, form, label and example is blank. */
fun WordContent.isBlank(): Boolean

object PasteLimits { const val TEXT = 20_000; const val DEFINITIONS = 8; const val FORMS = 12
    const val EXAMPLES = 6; const val WORD = 60; const val DEFINITION = 300
    const val PART_OF_SPEECH = 30; const val LABEL = 40; const val EXAMPLE = 300 }
```

`FORMS` is per definition and `EXAMPLES` per form; `WORD` also limits a form's text.

Rules, checked in this order; the first failure is the result. Every string is trimmed
before it is checked or kept; a value that isn't a JSON string counts as missing.
Definitions are numbered from 1 in messages. When the text is valid JSON but the wrong shape, the messages below (from "no word" to "doesn't contain") start with "That's valid JSON, but not what Tortoise Spelling needs."

| Check | Message |
|---|---|
| `text.length > TEXT` | That's too long to be one word's answer. |
| No `{` … `}` | There's no JSON in that. Copy the chat's whole answer and paste it again. |
| The text between them doesn't parse | That JSON is broken, so Tortoise Spelling can't read it. A bracket or comma may be missing. Ask the chat to fix it, or copy its whole answer again. |
| `word` missing or blank | The answer has no "word". |
| `word` is only dots or `…` (the prompt's placeholder, so the prompt itself was pasted back) | That's the prompt, not the chat's answer. Paste the chat's reply instead. |
| `definitions` missing, not an array, or empty | The answer has no definitions. |
| Definition *n* has blank `text` | Definition *n* has no text. |
| Definition *n* has no `forms` (missing, not an array, empty) | Definition *n* has no forms. |
| A form in definition *n* has blank `text` | A form in definition *n* has no text. |
| A form has no non-blank example | “*form*” has no example sentence. |
| `exampleMissesForm(example, form)` | “*example*” doesn't contain “*form*”. |
| Any count or field over its limit | That answer is longer than a word needs. Ask the chat for a shorter one. |

The per-definition rows run as one pass in document order, so the first failure is the
same on both platforms: definition 1's text, then its forms (missing or empty), then
each of its forms in turn (its text, then whether it has a non-blank example, then each
example in order against `exampleMissesForm`), then definition 2 the same way. A bad
example in definition 1 is reported before definition 2's missing text. The limits row
runs only after that whole pass, on the trimmed answer with blank examples dropped and
before the base form is moved or added, so a first definition of 12 forms that gains a
base form is still valid.

On success: `partOfSpeech` and `label` default to `""`; blank examples are dropped;
the base form is moved or added first (above); `renames = typedWord.isNotBlank() &&
normalizeWord(word) != normalizeWord(typedWord)`. Every `ExampleDraft.shownAt` is null.
Unknown keys are ignored. Parsing uses the default `Json`, which is strict like
`JSON.parse` (no trailing commas, no unquoted keys), so the web port accepts the same text. `summary()` counts the returned content, so a base form added
without examples shows in the form count.

`domain` importing `normalizeWord` from `data/Word.kt` is what `word-forms`' `CardPick`
already does.

### The add/edit screen

`AddWordUiState`:

- Loses `lookingUp` and `canLookUp`. Keeps `hasApiKey` for the auto-refresh toggle's copy.
- Gains `paste: PasteDraft?`, null while the dialog is closed, with
  `data class PasteDraft(val text: String = "", val result: PastedLookup? = null)`
  (result null while the text is blank).
- `canCopyPrompt = text.isNotBlank()`.
- `fun applying(answer: PastedLookup.Valid): AddWordUiState`, pure: `text` becomes
  `answer.word`, `content` becomes `answer.content`, `paste` becomes null, and `message`
  becomes "Corrected spelling to “*word*”." when `answer.renames`, otherwise unchanged.

`AddWordViewModel` loses `ClaudeClient` (its factory stops passing `container.claude`)
and `lookUp()`. It gains `openPaste()` (`paste = PasteDraft()`), `onPasteTextChange(value)`
(stores the text and `parsePastedLookup(value, state.text)` unless blank),
`usePaste()` (applies a `Valid` result, otherwise does nothing) and `dismissPaste()`.
Saving is unchanged: a new word goes through `addWord(text, content, …)`, an edit through
`updateWord`, so pasting onto an existing word keeps its scheduling and its review log.

`AddWordContent` replaces the Look up row, under the word field:

- A `FlowRow` of two `OutlinedButton`s: **Copy prompt** (`Icons.Default.ContentCopy`,
  enabled by `canCopyPrompt`, tag `ADD_WORD_COPY_PROMPT`) and **Paste answer**
  (`Icons.Default.ContentPaste`, always enabled, tag `ADD_WORD_PASTE`).
- Under them, in the old hint's `bodySmall` style: "Copy the prompt into any chat AI,
  such as Claude or ChatGPT. Then copy its whole reply and tap Paste answer."
- New callbacks `onCopyPrompt`, `onOpenPaste`, `onPasteTextChange`, `onUsePaste`,
  `onDismissPaste`; `onLookUp` goes.

The paste dialog, in the same file, shown while `state.paste != null`: an `AlertDialog`
titled "Paste the answer". Its `text` slot is a `Column` with
`Modifier.semantics { testTagsAsResourceId = true }` (a dialog is its own window; see
`e2e/README.md`) holding:

- An `OutlinedTextField`, label "The chat's answer", `minLines = 4`, `maxLines = 8`,
  tag `ADD_WORD_PASTE_TEXT`, focused when the dialog opens (Gboard then offers the
  copied reply as a one-tap chip). `isError` for `Invalid`. Supporting text: "Paste the
  chat's whole reply." while blank, the `Invalid` message, or the `Valid` summary.
- For a `Valid` result with `renames`: "This answer is for “receive”. Using it changes
  the word from “recieve”."
- For a `Valid` result when `state.isEditing || !state.content.isBlank()`: "Using it
  replaces the definitions, forms and examples on this screen."

Buttons: **Use this** (`TextButton`, enabled only for `Valid`, tag `ADD_WORD_PASTE_USE`)
and **Cancel**. Dismissing outside the dialog is Cancel. The dialog's state lives in the
ViewModel, so it survives rotation.

`AddWordScreen` does the copy, since it has the Compose clipboard:
`rememberCoroutineScope().launch { LocalClipboard.current.setClipEntry(ClipEntry(
ClipData.newPlainText("Lookup prompt", lookupPrompt(state.text)))) }` (read
`LocalClipboard.current` in composition, not in the lambda), then, below API 33, the
snackbar "Prompt copied." through the screen's `SnackbarHostState`.

Test tags: `ADD_WORD_LOOK_UP` goes; `ADD_WORD_COPY_PROMPT`, `ADD_WORD_PASTE`,
`ADD_WORD_PASTE_TEXT` and `ADD_WORD_PASTE_USE` join `TestTags.kt`, and the e2e suite's
uses join `e2e/support/testIds.ts` (`addWordLookUp` goes there too).

### Settings

`ClaudeLookupSection` keeps its fields and Test key. Its title becomes "Keep cards
fresh" and its help text "Optional. Only “Keep this card fresh” uses a key: Claude adds
a new example sentence when the word comes up. Lookup works without one: use Copy prompt
when you add a word." No tag or behaviour change.

### e2e

`e2e/features/claude_lookup.feature` loses its two lookup scenarios ("Looking up a word
fills in the card", "A misspelled word is corrected") and keeps the Background and the
key test. Its narrative says the key is for keeping cards fresh. The steps only those
scenarios used go from `claude_lookup.steps.ts` (`I look it up with Claude`, `the
definition is filled in`, `the example contains {string}`, `the part of speech reads
{string}`, `the word reads {string}`), and `addWord.lookUpButton` goes.

New `e2e/features/copy_prompt.feature`:

```gherkin
Feature: Looking a word up with a chat AI
  As a learner who doesn't want to write definitions
  I want to paste a chat AI's answer into a word
  So that it gets its definitions, forms and examples in one go, with no API key

  Scenario: A pasted answer fills in the word, ready to save
    Given I have no words yet
    When I start adding the word "practice" without a definition
    And I copy the lookup prompt
    Then the clipboard holds the lookup prompt for "practice"
    When I paste the chat's answer for "practice"
    Then I see "2 definitions, 4 forms, 4 example sentences"
    When I use the answer
    And I save the changes
    Then I am told "Added ✓ (1 total)"
    When I open the word list
    Then "practice" is listed with the definition "repeated exercise to improve a skill"
    When I search for "practise"
    Then "practice" is listed
```

New steps in `e2e/step-definitions/copy_prompt.steps.ts`, with screen helpers in
`support/screens/addWord.ts`:

- `I copy the lookup prompt`: clicks Copy prompt.
- `the clipboard holds the lookup prompt for {string}`: `driver.getClipboard('plaintext')`,
  base64-decoded, contains `I'm learning to spell "practice".`. If UiAutomator2 can't read
  the clipboard on the phone (Android 10+ restricts it to the focused app), delete this
  step and its line from the feature, and say so in the log and here; the unit tests
  cover the text and the component test covers the button.
- `I paste the chat's answer for {string}`: clicks Paste answer and `typeInto`s the
  answer field with the answer from `e2e/support/lookupAnswers.ts`, a map from word to a
  single-line JSON string (UiAutomator2's `setValue` may turn a newline into Enter). The
  "practice" answer is `docs/copy-prompt-lookup.md`'s example, fenced as a chat app
  would (` ```json … ``` `), so the device run also proves the fence is stripped.
- `I use the answer`: clicks `ADD_WORD_PASTE_USE` and waits for the dialog to close.

Two definitions of forms and examples push Save below the fold, and UiAutomator2 can't
click an off-screen node. `addWord.save()` scrolls it into view first
(`scrollToTestId(testIds.addWordSave)`), unless `word-forms` build-3 already made it do so.

`I save the changes`, `I am told`, `I see`, `I open the word list`, `I search for` and
the listing steps exist.

### Docs

- `CLAUDE.md`, "Claude lookup" becomes "Lookup": Copy prompt puts `lookupPrompt(word)`
  on the clipboard; the reply is pasted into a dialog and `parsePastedLookup` validates
  it (JSON located between the outer braces, exact messages, limits in `PasteLimits`);
  Use this replaces the editor's word and content, and saving keeps scheduling; nothing
  in the app calls an API for lookup. `ClaudeClient` and its model discovery stay only
  for "Keeping cards fresh" until `drop-api-key`; the `lookupRequest`/`StaleCard` lines
  move under that section. `domain/` in Layers adds the prompt and paste parsing.
- `README.md`: the "Your words" bullet says a ready-made prompt goes into any chat AI and
  its answer is pasted back; "Everything except word lookup works fully offline…"
  becomes "Everything works offline with no account and no API key."; the "Word lookup
  with Claude" section becomes "Word lookup with any chat AI", describing the round trip,
  with a closing line that an Anthropic key in Settings is now only for "Keep this card
  fresh".
- `PRIVACY.md`: the opening says nothing leaves the phone except what you choose to
  paste into a chat app, and "Keep this card fresh" if you add a key. "Word lookup" in
  "What leaves your device" becomes: Copy prompt only copies text; what you paste into a
  chat app is between you and that service. A "Keep this card fresh" paragraph says it
  sends the word with its current definition and example to Anthropic with your key
  (today's text says only the word is sent, which the refresh already contradicts), and
  Test key and model discovery as before. The Internet permission row reads "Keep this
  card fresh, with your own Anthropic key."
- `CHANGELOG.md`, under `[Unreleased]`: `### Added` "**Copy prompt** and **Paste
  answer** when adding or editing a word: copy a ready-made prompt into any chat AI you
  already use, such as Claude or ChatGPT, paste its answer back, and the word's
  definitions, forms and example sentences fill in. No API key needed."; `### Removed`
  "**Look up with Claude** on the add and edit screen, which Copy prompt replaces. An API
  key is now only used to keep cards fresh."
- `e2e/README.md`: the `@live-api` row says it covers the key test only.
- `docs/copy-prompt-lookup.md`: status "implemented", with a short "As built" list of
  this spec's settled points. `docs/todo.md`: tick the copy-prompt item.

## Build steps

Each step follows `CLAUDE.md`'s Workflow and `PROTOCOL.md`. "Passing" means every command
exits 0. Connected runs and e2e go to the phone `ANDROID_SERIAL` names (rerun
`bash jogging/cloud-setup.sh` if `adb devices` doesn't list it). Abbreviations, as in
`word-forms`:

- `<layer X>`: `./gradlew connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.package=io.github.dontpanic345.tortoisespelling.X`
- `<e2e F…>`: `cd e2e && npm run e2e -- --spec features/F.feature …`, one `--spec` per
  file.

### build-1: the prompt and the paste parser (Sonnet, medium)

`domain/LookupPrompt.kt` and `domain/PastedLookup.kt` as under "The prompt" and "Parsing
and validation". No UI.

Tests (JVM):

- `LookupPromptTest`: the text for "necessary" equals the spec's text verbatim (one
  expected string in the test, so a wording change is deliberate); the word is trimmed.
- `PastedLookupTest`:
  - `docs/copy-prompt-lookup.md`'s example parses: 2 definitions, the forms and
    examples in order, parts of speech and labels kept, `renames` false, and `summary()`
    "2 definitions, 4 forms, 4 example sentences".
  - A ` ```json ` fence, and a line of prose before and after, both parse the same.
  - Markdown backslashes before brackets (`\[ ... \]`) parse the same; `\\[` keeps its backslash.
  - One test per row of the table, asserting the exact message; definition numbering is
    1-based; a non-string `text` counts as missing.
  - Order: a bad example in definition 1 and a blank definition 2 report the example;
    an over-limit field alongside a missing example reports the example.
  - Each limit, at the limit (valid) and one over (the "longer than a word needs"
    message); `TEXT` is checked before parsing.
  - Blank examples are dropped; missing `partOfSpeech`/`label` become `""`; unknown keys
    are ignored; `shownAt` is null throughout.
  - Base form: already first, stays; second in the first definition, moves first; only
    in the second definition, a base form with no examples is added to the first and the
    summary counts it; match is case- and space-insensitive.
  - `renames`: true for "recieve" → "receive"; false for "Practice" → "practice"; false
    with a blank typed word.
  - "practise" under a definition of "practice" is valid (forms needn't share letters).
  - `summary()` singulars: "1 definition, 1 form, 1 example sentence"; `isBlank()` true
    for the new-word draft and false once any field has text.

Acceptance:

```bash
./gradlew testDebugUnitTest --tests '*LookupPromptTest' --tests '*PastedLookupTest'
./gradlew testDebugUnitTest lintDebug
```

- Temporarily skip the `exampleMissesForm` check: `PastedLookupTest` fails. Temporarily
  drop the base-form move: it fails too. Revert both.

### build-2: the add/edit screen (Sonnet, high)

Everything under "The add/edit screen" and "Settings": the state and ViewModel changes,
the buttons, the dialog, the clipboard write, the tags, and the Look up row's removal.
Also the first paragraph under "e2e" (the lookup scenarios, their steps,
`lookUpButton` and `addWordLookUp` go), so the app's tags and the suite change together.
High effort: a dialog window, the clipboard API and three test layers in one step.

Tests:

- `AddWordUiStateTest`: `canCopyPrompt` follows the word; `applying` replaces text and
  content and closes the dialog, sets the corrected-spelling message only when
  `renames`, and keeps `editingId`, `autoRefresh` and the burst counters.
- `AddWordContentTest` (`component` layer):
  - Copy prompt is disabled with a blank word, enabled with one, and calls
    `onCopyPrompt`; Paste answer calls `onOpenPaste`; there's no "Look up with Claude".
  - The dialog with an `Invalid` result shows its message and Use this is disabled.
  - With a `Valid` result it shows the summary; Use this is enabled and calls
    `onUsePaste`; Cancel calls `onDismissPaste`.
  - The rename line shows only with `renames`; the replace line shows when editing and
    not for a blank new word.
  - Typing in the answer field reaches `onPasteTextChange`.
- Accessibility and screenshot states, light and dark: a new word with the two buttons;
  the dialog with an error; the dialog with a valid answer that renames. Re-record the
  existing add-screen references, whose Look up row changed. If Layoutlib won't render
  the `AlertDialog`, the screenshot states render the dialog's `text` content on a
  `Surface` instead, and this spec records it.
- On the phone, by hand through `adb`: open Add word, type "rhythm", tap Copy prompt,
  then `adb shell cmd clipboard get-primary-clip` (or paste into the answer field) shows
  the prompt. Note in the log what was seen.

Acceptance:

```bash
./gradlew assembleDebug testDebugUnitTest lintDebug assembleDebugAndroidTest
<layer component>
<layer accessibility>
./gradlew updateDebugScreenshotTest && ./gradlew validateDebugScreenshotTest   # look at the new references
grep -rn "lookUp\|ADD_WORD_LOOK_UP\|Look up with Claude" app/src e2e/support e2e/step-definitions   # no matches
cd e2e && npm run check-steps -- --all && npm run typecheck
<e2e add_word word_forms word_list settings>
```

- Temporarily enable Use this for an `Invalid` result: `AddWordContentTest` fails. Revert.

### build-3: e2e, docs and changelog (Sonnet, medium)

The new feature and steps under "e2e", and everything under "Docs".

Acceptance:

```bash
cd e2e && npm run check-steps -- --all && npm run typecheck   # no undefined or unused steps
<e2e copy_prompt add_word word_forms>   # word_forms too: addWord.save() may have changed
./gradlew testDebugUnitTest lintDebug
grep -n "Unreleased" -A10 CHANGELOG.md   # the Added and Removed lines are there
grep -n -i "look up with claude" README.md PRIVACY.md CLAUDE.md e2e/README.md   # no matches
```

### review (Sonnet, high)

Review the whole piece against this spec and `GOALS.md`, independently. In particular:
nothing in the add/edit path calls `ClaudeClient` (goal 3); `lookupPrompt`'s text matches
the spec, and every rule the prompt states is one the parser checks or tolerates; every
message in the table is tested verbatim; the base form is first before `preparedFor`
runs; pasting onto an existing word keeps its scheduling and review log (save one in the
app, check `review_log` and `dueOn` through `adb shell run-as … sqlite3` or the word list
status); the dialog's tags reach Appium; `PRIVACY.md` says what the code sends; no
war-story comments. High effort: the prompt-parser contract is what the web app copies,
and a gap there ships twice.

Run the full checks: unit, lint, all four instrumented layers, screenshot validation, the
whole e2e suite (`cd e2e && npm run e2e`), and the release smoke on a signed release
build (`npm run e2e:release`, with the debug-keystore variables `CLAUDE.md` gives). Then
finish with `node scripts/bump-version.mjs minor`, commit and push, and watch the release
run to the end.

## What later pieces rely on

- **`drop-api-key`**: the add/edit screen no longer touches `ClaudeClient`; only
  `CardRefresher`, Settings' key section (now "Keep cards fresh") and the toggle's
  `hasApiKey` copy remain. It deletes those, `claude_lookup.feature` (now just the key
  test) and its steps, and `PRIVACY.md`'s "Keep this card fresh" paragraph and Internet
  permission row. `AddWordViewModel` then loses `SettingsStore` if nothing else reads it.
- **`web-core`**: ports `lookupPrompt` (identical text, `LookupPromptTest`'s expected
  string as the golden), `parsePastedLookup`, `summary`, `isBlank` and `PasteLimits`,
  with golden tests from `PastedLookupTest` asserting the same messages. JavaScript
  string lengths count UTF-16 units, as Kotlin's do, so the limits agree.
- **`web-ui`**: the same two buttons, help text, dialog states and copy, and the same
  `applying` rule. `navigator.clipboard.writeText` for Copy prompt; the answer is pasted
  into a textarea, never read from the clipboard by the app.
- **`shared-specs`**: `copy_prompt.feature` is a shared scenario. The clipboard step is
  per platform (Appium's `getClipboard`, Playwright's clipboard permission), or
  Android-only if build-3 dropped it.
