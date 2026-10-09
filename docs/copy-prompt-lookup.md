# Copy-prompt lookup instead of the API button (idea, not yet implemented)

Status: **idea**. Nothing here is built.

## Idea

Replace the "Look up with Claude" button on the add/edit screen (`ui/add/AddWordScreen.kt`)
with a **Copy prompt** button:

1. The user taps Copy prompt. The app puts a ready-made prompt on the clipboard, containing
   the word and the required JSON shape.
2. The user pastes it into any AI chat they already use (Claude, ChatGPT, etc.) and gets
   back structured JSON.
3. The user copies that JSON and pastes it into a field in the app.
4. The app parses it, validates it, and fills in the definitions, word forms and example
   sentences.

The app never calls an API for lookup, so the user doesn't need an Anthropic key for it.

## Target output

Roughly a dozen items in total: the main definitions, the main word forms, and example
sentences. Example:

```json
{
  "word": "practice",
  "definitions": [
    {
      "text": "repeated exercise to improve a skill",
      "partOfSpeech": "noun",
      "forms": [
        { "text": "practice", "label": "singular", "examples": ["She has piano practice on Tuesdays."] },
        { "text": "practices", "label": "plural", "examples": ["He runs two medical practices."] }
      ]
    },
    {
      "text": "to perform an activity repeatedly to improve at it",
      "partOfSpeech": "verb",
      "forms": [
        { "text": "practise", "label": "base", "examples": ["I practise every day."] },
        { "text": "practised", "label": "past tense", "examples": ["He practised for hours."] }
      ]
    }
  ]
}
```

The shape follows [word-forms.md](word-forms.md): definitions, then forms per definition,
then example sentences per form. The "about a dozen" target is a guide for the prompt, not
a hard count. The model decides how many definitions and forms apply.

## Validation on paste

Keep it simple. Reject with a clear message rather than trying to repair the JSON:

- The text parses as JSON. Strip a leading or trailing code fence (` ```json `) if present,
  since chat windows add them.
- `word` matches the word being edited, or the user is asked to confirm a mismatch.
- At least one definition, and each definition has at least one form.
- Every form has non-blank `text` and at least one example.
- Each example contains its form's `text`. This is the blanking rule in `Word.kt`/review:
  the review screen blanks the form out of the sentence, so a sentence without it is useless.
- Length limits on fields, so a malformed paste can't store something huge.

On success, show a preview (definition count, form count, example count) and let the user
save or cancel.

## Things to settle before building

- **Prompt wording.** It has to ask for JSON only, no prose, and state the exact schema.
  It is worth testing across chat apps, since some wrap output in markdown.
- **Auto-refresh.** `CardRefresher` rewrites cards with the API each day. Under this idea
  the API key would still be needed for that, unless auto-refresh is also dropped or
  changed to a manual copy-prompt round. Decide this first.
- **Storage.** The paste lands in the Room schema from [word-forms.md](word-forms.md), so
  this idea and that one should be designed together. A single paste maps to the nested
  tree there.
- **Manual editing.** Users may want to fix one example by hand after pasting. That should
  work without re-pasting everything.
- **Docs to update if built.** `CLAUDE.md` describes the Claude lookup in detail, and
  `PRIVACY.md` describes what leaves the device. Both would change.
