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
        ├── id, definitionId, text (the inflected form), partOfSpeech
        │   (e.g. "verb", "noun"), label (e.g. "plural", "past tense",
        │   "3rd person singular" — whatever Claude returns), orderIndex
        │
        └── ExampleSentence (new, 1..N per WordForm)
            ├── id, wordFormId, text, orderIndex, usedAt? (for rotation)
```

`partOfSpeech` lives on `WordForm`, not `Definition` or `Word`. The same
surface spelling can appear under two different definitions with two
different parts of speech — "runs" is the plural noun form under one sense of
"run" and the 3rd-person-singular verb form under another — so POS has to be
per-form to tell those apart. See Examples below.

Notes / open questions to settle before writing the migration:

- Does the base word's own spelling need to be represented as a `WordForm` too
  (so "run" is just the form with no special label under its first definition),
  or does review always target `Word.text` and forms are strictly the *other*
  spellings to show as content variety? This affects how the review screen picks
  which spelling to blank out and ask for.
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

## Distribution: bundled vs. remote-hosted dictionary

Separate from the core schema above (which covers how a *user's own* word gets
its definitions/forms/examples via a Claude lookup), there's an optional idea
of pre-building the same structure for a large fixed vocabulary — e.g. the
20,000 most common English words — as a shared reference dictionary, so
adding a common word doesn't need its own Claude API call. Whether this is
actually in scope, or purely a hypothetical, is itself an open question (see
below) — but the two ways to get such a dictionary onto a device are worth
recording:

**Bundled.** Ship the ~20-40 MB database as an asset, imported once. Fully
offline from install onward. Bigger APK, and it's a Room-schema-shaped blob
that needs to stay in sync with the app's migrations.

**Remote, fetched on demand.** Publish the dictionary as small static JSON
files (sharded per word or per letter, with a manifest) and have the app
fetch a word's entry over plain HTTP the first time it's needed, caching the
result into Room afterwards exactly like a Claude lookup does today. Doesn't
bloat the APK, and only ever downloads what a user's word list actually
touches — but a fresh word needs network once before it can be reviewed
offline, which today's fully-local Room DB never requires.

Hosting cost for the remote option is effectively $0 at this scale:
- **jsDelivr** (`cdn.jsdelivr.net/gh/<user>/<repo>@<tag>/<path>`) — a free
  public CDN that serves straight from a GitHub repo, no build step, no
  rate-limit concerns. The best fit if the source of truth is already a
  GitHub repo, since it avoids `raw.githubusercontent.com` directly (not an
  intended CDN, can throttle).
- **Cloudflare Pages** or **Cloudflare R2** — free tier, generous bandwidth
  (R2 has no egress fee at all), a bit more setup than pointing at an
  existing repo.
- **GitHub Pages** — also free, same "not officially a CDN" caveat as raw
  GitHub content, just under Pages' terms instead.

Any of these comfortably covers this workload for free — the free tiers are
sized for far more traffic than a niche spelling app's per-word JSON fetches
would generate.

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

## Examples

**"run" — same spelling, different POS depending on sense.**

```
Word: run
├── Definition 1: "to move fast on foot, faster than a walk"
│   ├── WordForm "run"      — verb, base              — "I run five kilometres every morning."
│   ├── WordForm "runs"     — verb, 3rd person sg.     — "She runs five kilometres every morning."
│   ├── WordForm "ran"      — verb, past tense         — "He ran the whole way home."
│   └── WordForm "running"  — verb, present participle — "They are running late."
│
└── Definition 2: "a period of continuous activity or operation; a batch"
    ├── WordForm "run"      — noun, singular — "The test had a clean run."
    └── WordForm "runs"     — noun, plural   — "We did three runs before it worked."
```

`run` and `runs` each appear *twice*, once per definition, with a different
part of speech each time. This is why `partOfSpeech` has to sit on `WordForm`
rather than `Definition`: putting it on `Definition` couldn't distinguish
"verb runs" from "noun runs" without duplicating the definition text too.

**"child" — a definition that only needs two forms.**

```
Word: child
└── Definition 1: "a young human being"
    ├── WordForm "child"    — noun, singular — "The child laughed."
    └── WordForm "children" — noun, plural   — "The children laughed."
```

No verb forms exist for this word, so none are generated — the "scale to what
applies" rule in practice.

**"practice" — the NZ/UK noun-vs-verb spelling split.**

In NZ/UK usage, *practice* is the noun and *practise* is the verb — a
genuinely different spelling, not just a suffix change:

```
Word: practice
├── Definition 1: "repeated exercise to improve a skill; a doctor's or lawyer's business"
│   ├── WordForm "practice"  — noun, singular — "She has piano practice on Tuesdays."
│   └── WordForm "practices" — noun, plural   — "He runs two medical practices."
│
└── Definition 2: "to perform an activity repeatedly to improve at it"
    ├── WordForm "practise"   — verb, base              — "I practise every day."
    ├── WordForm "practises"  — verb, 3rd person sg.     — "She practises every day."
    ├── WordForm "practised"  — verb, past tense         — "He practised for hours."
    └── WordForm "practising" — verb, present participle — "They are practising now."
```

This is a case worth calling out rather than quietly deciding: `practice`/
`practise` aren't inflections of one spelling with a suffix swapped — the
*root itself* changes spelling by sense. `WordForm.text` already has to be
independent of `Word.text` in the ordinary case (e.g. "ran" doesn't share
letters with "run" either), so this probably falls out for free as long as
nothing in the schema or UI assumes a form's text is derived from the root's
text by simple suffixing. Flagged in the open questions below.

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
3. What happens to existing words on migration — one synthesized
   Definition/WordForm/ExampleSentence per existing row, as noted above?
4. Does the add/edit word screen let a user hand-edit individual forms/examples,
   or is that Claude-only content with the user only editing the root word and
   toggling `autoRefresh`-equivalent behaviour?
5. Is it acceptable for a `WordForm.text` to not share any letters with the
   owning `Word.text` (the "practice"/"practise" case)? If so, does the word
   list / search-by-normalized-text still only match against `Word.text`, or
   should it also match a word's forms (e.g. searching "practise" should find
   the "practice" entry)?
6. Is a pre-built shared dictionary for a large fixed vocabulary (see
   Distribution, above) in scope at all, or does every word — common or not —
   go through the same per-user Claude lookup regardless?
