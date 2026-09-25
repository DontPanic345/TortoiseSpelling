# Word forms (design doc, not yet implemented)

Status: **proposal**. Captures a conversation about extending word cards to cover
related word forms (plurals, verb tenses, etc.) without turning them into separate
SRS items. Nothing here is built yet — this is the plan to implement against.

## Problem

Today a `Word` is one flat string with one definition, one example sentence and its
own SM-2 state (`data/Word.kt`). There's no way to relate "run" and "running": they'd
have to be entered as two unrelated words, each learned and scheduled independently,
which is pointless — the user already knows the base word once they know it.

## Goals

- A word can carry multiple definitions (senses), scaled to how many the word
  actually has — not a fixed number.
- Each definition can carry multiple word forms (e.g. plural, past tense),
  again scaled to what applies, not padded to a fixed count.
- Each word form carries several example sentences, banked up front, so the app
  can rotate through fresh-looking examples without calling Claude every time.
- A single Claude lookup populates the whole tree (definitions → forms → example
  sentences) in one call.
- SM-2 scheduling stays exactly where it is today: one set of review state per
  **root word**. Word forms and extra definitions are content richness only —
  they are never independently due, never separately graded, and never show up
  as their own row in the word list or review queue.

## Non-goals

- No per-form spaced repetition. The user is not asked to spell "running" on a
  different schedule than "run" — that's the thing this explicitly avoids.
- No change to how a review is graded (`Grade`, quality 2/5) or to `Sm2Scheduler`.

## Proposed data model

Three new tables under a word, replacing the single `definition`/`example`
columns on `Word`:

```
Word (existing entity, trimmed)
├── id, text, normalizedText, partOfSpeech?, SM-2 state, autoRefresh, refreshedOn, ...
│   (definition/example columns removed — see below)
│
└── Definition (new, 1..N per Word)
    ├── id, wordId, text, orderIndex
    │
    └── WordForm (new, 1..N per Definition)
        ├── id, definitionId, text (the inflected form), label (e.g. "plural",
        │   "past tense" — whatever Claude returns), orderIndex
        │
        └── ExampleSentence (new, 1..N per WordForm)
            ├── id, wordFormId, text, orderIndex, usedAt? (for rotation)
```

Notes / open questions to settle before writing the migration:

- Does the base word's own spelling need to be represented as a `WordForm` too
  (so "run" is just the form with no special label under its first definition),
  or does review always target `Word.text` and forms are strictly the *other*
  spellings to show as content variety? This affects how the review screen picks
  which spelling to blank out and ask for.
- `partOfSpeech` currently lives on `Word`. It probably belongs on `Definition`
  instead, since different senses can be different parts of speech (e.g. "run"
  the verb vs. "run" the noun).
- Room migration: this replaces two columns on `words` with three new tables and
  needs data migration for existing rows (wrap the current `definition`/`example`
  into a single `Definition` + single `WordForm` + single `ExampleSentence>`) —
  version bump plus a real `Migration`, no `fallbackToDestructiveMigration`.

## Claude lookup

`ClaudeClient`'s lookup prompt changes from "give me one definition and one
example" to "give me every definition that applies, and for each, every common
word form, and for each form, several example sentences." The response schema
grows a nested JSON shape instead of the current flat one; `parseLookup` stays
lenient about prose around the JSON.

The model decides *how many* definitions/forms to return per word — the app
does not pad or truncate to a fixed count. Example sentence count per form is
still bounded (a handful, e.g. 3-5) so the payload stays reasonable and the
rotation pool in "keeping cards fresh" below has enough to draw from.

## Keeping cards fresh — superseded by the example pool

`CardRefresher` today re-asks Claude for a brand-new definition + example once
a day per word (`autoRefresh`, capped at one rewrite/day, see CLAUDE.md). With a
bank of several example sentences per word form already fetched, day-to-day
freshness becomes: **rotate to the next unused example sentence for the form
being reviewed**, no API call needed. `refreshedOn`/`autoRefresh` as "hit Claude
again" only kicks in once the bank of example sentences for a form is
exhausted (or on user-requested refresh), and at that point it should refresh
that one form's example pool rather than the whole word.

Practically:
- `CardRefresher`'s trigger (review session starting, once/day/word) stays.
- What it *does* changes: first check whether the current word form still has
  an unused example sentence; if so, just advance the rotation pointer
  (`usedAt`/`orderIndex` bookkeeping, no network call). Only fall back to a
  Claude call when the pool for that form is used up.
- A full Claude re-fetch (new definitions/forms, not just new examples) becomes
  a rarer, more deliberate action — e.g. a manual "regenerate" from the edit
  screen — rather than the automatic daily behaviour.

## Review flow implications

- The review queue still contains one entry per root `Word`, scheduled exactly
  as today.
- When a word comes up, the app picks a definition (if multiple) and a word
  form (if multiple) to present — needs a policy (random? cycle in order?
  always the base form with forms as occasional variety?). Open question.
- The existing blanking behaviour (`_____`, `hideWordInDefinition`) needs to
  operate on whichever form's spelling is being tested, not always
  `Word.text`.
- Answer checking presumably still compares against the specific form's text
  shown, not always the root word.

## Open questions to resolve before implementation

1. Is the root word itself modelled as a `WordForm`, or kept special?
2. How does the review screen choose which definition/form/example to show
   each time the word is due — and does that choice interact with "keep it
   fresh" rotation?
3. Where does `partOfSpeech` move to?
4. What happens to existing words on migration — one synthesized
   Definition/WordForm/ExampleSentence per existing row, as noted above?
5. Does the add/edit word screen let a user hand-edit individual forms/examples,
   or is that Claude-only content with the user only editing the root word and
   toggling `autoRefresh`-equivalent behaviour?
