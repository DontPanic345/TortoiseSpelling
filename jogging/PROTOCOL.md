# Jogging protocol

Jogging works through The Work one step at a time, in cold sessions. `jogging/jog.mjs`
(the support crew) picks the next step, checks the budget, and starts one `claude -p`
session per step with the model and effort the step names. That session is you. The
crew runs in GitHub Actions (`.github/workflows/jogging.yml`) every six hours.

You have no context beyond the repo. `CLAUDE.md` is already loaded. Read
`jogging/GOALS.md`, your piece in `jogging/state.json`, and the end of `jogging/LOG.md`.
Then do **only the step you were given**, and finish as "Finishing a step" says.

## Files

| File | Who writes it |
|---|---|
| `GOALS.md` | Alan. Read-only for sessions. |
| `state.json` | The crew: every step's and piece's status, attempts, blockers and replies. A `spec` or `spec-review` session adds or edits its piece's `steps`, and nothing else. Alan sets `enabled`. |
| `LOG.md` | Every session appends one entry. |
| `specs/<piece>.md` | Phase 1 sessions; Phase 2 sessions may correct them. |
| `runs/result.json` | Every session, last: how the step ended. Not committed. |

## Phase 1: specification

**`spec` step (Opus).** Write `specs/<piece>.md` from the piece's `docs` and the code as it
is now. It must contain:

- What the piece delivers, and which goals and decisions it leans on.
- The design: data model, screens, files touched, migrations, docs to update
  (`CLAUDE.md`, `README.md`, `PRIVACY.md`, `CHANGELOG.md`).
- **Build steps** small enough for one session each. Every step has a runnable
  acceptance check: the exact commands, and what passing looks like. Name e2e features
  only for a step that adds or changes a feature or its steps, or changes what the steps
  find or assert (test tags, text, the order of screens). Logic and data changes are
  proven by unit and instrumented tests, and the review step runs the whole suite.
- The **model and effort** for each build step and for the final review step. Default
  to Sonnet; use Sonnet at low effort for mechanical work. Never Haiku: it has no auto
  mode, so an unattended session can't run a command or edit a file. Opus needs a
  one-line justification in the spec, review steps included.
- What a later piece will rely on (for pieces listed as depending on this one).

Then append the build steps and the review step to the piece's `steps` in `state.json`:

```json
{ "id": "build-1", "phase": 2, "title": "…", "model": "sonnet", "effort": "medium", "status": "pending" }
```

The last step is `{ "id": "review", "phase": 2, … }`.

**`spec-review` step (Opus).** Review the spec as an independent reader against the goals,
the decisions and the code. Apply every substantive finding to the spec and to its steps
in `state.json` yourself. Leave style nits alone.

Specs are written for every piece before any building starts. A later spec can assume
earlier pieces are built as specified.

## Phase 2: build

**Build step.** Do exactly what the step in the spec says, then run its acceptance check.
Follow `CLAUDE.md`'s Workflow for unit tests and lint, but run only the e2e features the
acceptance check names, and none if it names none. Add a `CHANGELOG.md` line for
user-visible changes. Commit and push when the check passes.

If the spec turns out wrong, fix the spec in the same commit and say so in the log.

**`review` step.** Review the whole piece as built, independently, against its spec and
the goals. Run the full checks again, including every e2e feature. Fix substantive
findings yourself; leave nits. Then watch `ci.yml` on your last push
(`gh run list --workflow ci.yml --commit <sha>`, then `gh run watch`); the step isn't
done until it's green. If the piece changes the Android app for users, finish with the
release bump from `GOALS.md`.

## In CI

- An emulator (API 34) is already running and `ANDROID_SERIAL` points at it. Don't start
  or kill one. Connected tests and e2e run at emulator speed.
- A failing e2e step is a failure. There's no list of known flaky steps; if one fails,
  find out why.
- `JAVA_HOME` and `ANDROID_HOME` are set. `gh` is signed in as `DontPanic345`.
- The job is cut short after about five and a half hours, and the crew stops your session
  after 90 minutes. Commit work that passes its checks as you go.
- Your transcript is kept for seven days as a workflow artifact, and anyone signed in to
  GitHub can read it. Never print secrets or the environment.

## Finishing a step

1. Append to `LOG.md`:
   `## <YYYY-MM-DD HH:MM> <piece>/<step> (<model>)` and two or three lines on the outcome.
2. Commit everything with a message naming the piece and step, and push. Don't change any
   `status` in `state.json`; the crew does that.
3. Write `jogging/runs/result.json`, with one of:
   - `{"status": "done"}`: the acceptance check passes and everything is pushed.
   - `{"status": "pending", "note": "<where the next session picks up>"}`: you ran out of
     room. Push whatever passes its checks first. A step that ends pending twice is
     blocked.
   - `{"status": "blocked", "blocker": "<what is needed from Alan, in one or two sentences>"}`:
     see Blockers.

No `result.json`, or a session that crashes, counts as pending.

## Blockers

Open questions are usually noise; settle them with `GOALS.md` and move on, noting the
choice in the spec or the log.

A **blocker** is something that makes progress on the piece impossible: an account,
secret or physical action only Alan can supply, a contradiction between goals, or a check
that can't pass for reasons outside the piece. For a blocker, log it, push, and end with a
`blocked` result. The crew opens a GitHub issue, and Alan gets it on his phone.

When Alan replies on the issue (or closes it), the next run unblocks the piece and gives
his reply to the next session in its prompt. Act on it.

Don't message Alan any other way, and don't create issues yourself.
