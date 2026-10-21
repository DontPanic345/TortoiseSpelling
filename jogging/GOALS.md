# Jogging goals

The Work is everything in `docs/todo.md` and the design docs it links. Use these goals to
settle open questions and roadblocks without asking Alan. Ask only when no goal decides
it, as a blocker.

## Goals, in priority order

1. **The word list and its progress are never lost.** Every schema change is a version
   bump with a real `Migration` and a migration test. Backups stay importable across
   versions, and between Android and web.
2. **The daily reminder keeps working.** Android's reminder behaviour (`CLAUDE.md`,
   "Daily reminder") doesn't change, and the web app gets one too.
3. **No API key anywhere.** Lookup is the copy-prompt round trip with whatever chat AI the
   user already has. Nothing in either app calls an AI API.
4. **Scheduling stays per root word.** SM-2 state, grading and the session rules are
   unchanged. Word forms, extra definitions and example sentences are content only.
5. **Two apps that behave the same.** The web app matches Android feature for feature,
   except where the platform forbids it, and the shared Gherkin specs prove it.
6. **Free to run.** No paid services. A free tier that needs an account Alan has to
   create is a blocker for that piece only.
7. **Simple over clever.** Follow `CLAUDE.md`, `CODING_STANDARDS.md` and the existing
   code's idiom.

## Decisions already made

These answer the open questions in the design docs. A spec may depart from one only when
a goal above requires it, and must say which.

- **Root word.** The root's own spelling is the base `WordForm` under its first
  definition. `Word.text` stays as the label in the word list and the review queue key.
- **What review shows.** The review screen asks for the least recently shown example
  sentence across all of a word's forms, with random tie-breaks, and blanks and checks
  *that form's* spelling. This one rule covers both the choice of form and the
  freshness rotation.
- **Keeping cards fresh.** `CardRefresher`, `autoRefresh` and `refreshedOn` go. Freshness
  comes from rotating through the banked examples. Getting new examples means running
  the copy-prompt round again from the edit screen.
- **Migration of existing words.** Each existing row becomes one `Definition`, one base
  `WordForm` and one `ExampleSentence`, built from its current columns.
- **Editing.** Users can add, edit and delete definitions, forms and examples by hand.
  Pasting a new lookup onto an existing word replaces its content and keeps its
  scheduling state.
- **Search.** Word-list search matches every form's text, so "practise" finds
  "practice".
- **Forms needn't share letters** with the root ("ran", "practise").
- **Web app.** It lives in `web/` in this repo, written in TypeScript, and is hosted on
  GitHub Pages. The spec picks the UI framework, favouring the smallest one that keeps
  the code plain and testable.
- **Web reminders.** Delivered by Web Push from a free-tier scheduled job, which the spec
  chooses. The server stores only push subscriptions and due dates, never words, and
  `PRIVACY.md` says so before push ships. Until push lands, the web app shows "due
  today" on Home.
- **Icon design is paid.** An exception to goal 6 that Alan approved on 20/10/2026: the
  `icon-redraw` piece may spend Recraft API units, up to the 10,000 bought for it.
  Nothing in either app calls Recraft.
- **Jogging on Actions.** Jogging runs as a scheduled GitHub Actions workflow beside an
  emulator (`.github/workflows/jogging.yml`). It's infrastructure, not a piece; the
  `jogging-poc` piece only proves it works.
- **Edit after a miss.** A miss undone by a saved edit from review's Edit word is the one
  exception to "a miss is recorded at the first attempt" (goal 4); grading and SM-2 are
  unchanged. Approved by Alan on 20/10/2026 (`docs/edit-after-miss.md`).
