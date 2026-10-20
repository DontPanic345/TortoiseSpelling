# Spec step

Write the piece's spec and a brief for each of its steps, from the piece's `docs` and the
code as it is now. Every spec is written before any building starts, so a spec can assume
earlier pieces are built as their specs say.

## The spec: `jogging/specs/<piece>.md`

For Alan and the piece's reviewer:

- What the piece delivers, and which goals and decisions it leans on.
- The design under `## Design`: data model, screens, files touched, migrations, and the
  docs to update (`CLAUDE.md`, `README.md`, `PRIVACY.md`, `CHANGELOG.md`).
- What later pieces will rely on, for pieces that depend on this one.

## The briefs: `jogging/specs/<piece>/<step>.md`

One for each build step, each small enough for one session, and one for the review. A
build session works from its brief and the code alone, so each brief is self-contained:

- It starts `# <piece>/<step>: <title>`, says what to build, and lists the tests that
  prove it.
- It carries all the design it needs, copied in from the spec: names, signatures, rules,
  file paths, copy. Briefs repeat design wherever two steps need the same part.
- It ends with `## Acceptance` and one `bash` block holding the checks `ci.yml` can't
  run. CI runs the unit, lint, instrumented, screenshot, web, push and e2e suites on
  every push. Every line is a command that exits 0 on a pass. Behaviour you would check
  by hand gets a test instead. The session runs the block, and the crew runs it again
  before the step counts. Leave the section out when CI covers everything.

The review brief names what this piece's review should look at hardest. When the piece
changes the Android app, its Acceptance block is the release smoke:

```bash
./gradlew assembleRelease
cd e2e && APK=../app/build/outputs/apk/release/app-release.apk npm run e2e:release
```

## `state.json`

Append the steps to the piece's `steps`, the review last, and edit nothing else in the
file but the piece's `release`:

```json
{ "id": "build-1", "phase": 2, "title": "…", "model": "sonnet", "effort": "medium", "why": "…", "status": "pending" }
```

Size each step's model and effort to its work, with the budget in mind, and give the
one-line reason in `why`:

- **Opus**: a step, or a piece's review, that touches goals 1 or 2 (data, the reminder),
  must keep both apps in agreement, involves concurrency or transactions, or is large.
- **Sonnet**: a contained step, or a small piece's review.
- **Haiku**: mechanical work with an exact check.

Set the piece's `release` to `"minor"` when it changes the Android app for users, or to
`"patch"` for a piece that only fixes the Android app. Test-only and web-only pieces have
no `release`. The crew bumps the version once the whole queue is done, and Alan checks
every step's model and effort before the builds start.
