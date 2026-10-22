# Jogging

Jogging works through The Work (`docs/todo.md` and the design docs it links) one step at a
time, in cold `claude -p` sessions, with no one watching. The support crew,
`jogging/jog.mjs`, runs in GitHub Actions every six hours beside an emulator. It picks the
next step, checks the budget, builds the session's prompt, starts the session on the
model and effort the step names, checks the result, and records it. The runner, its
secrets and the design decisions behind them are in
[`docs/jogging-on-github-actions.md`](../docs/jogging-on-github-actions.md).

It is built for a budget-conscious user: one session per step, the fewest tokens that do
the step well, and checks run by the crew rather than by sessions.

## Pieces and steps

A **piece** is one item of The Work. It goes through these steps:

| Step | Phase | What it does |
|---|---|---|
| `spec` | 1 | Writes `specs/<piece>.md`, a brief per step in `specs/<piece>/`, and the steps in `state.json` |
| `spec-review` | 1 | Reviews the spec and briefs as their sessions will read them, and fixes them |
| `build-N` | 2 | Builds what its brief says |
| `review` | 2 | Reviews the whole piece's diff, fixes what's substantive |

Every spec is written before any build starts. Then the crew opens one issue listing
every pending build and review step's model and effort, and those pieces' builds wait
until Alan answers it: a line per change, such as `speak-word/build-2 opus high`, or
closing the issue to keep them all. The crew applies the lines, says what it changed and
what it couldn't read, and marks the pieces `modelsChecked`. Builds also wait for the
pieces they depend on. A finished piece is removed from `state.json`, and its spec and briefs from `specs/`. Git
history keeps them.

## What a session gets

The crew writes each session's whole prompt, passes it on stdin and saves it beside the
transcript as `runs/*.prompt.md`. Each prompt has the step's brief (or, in phase 1, what
to read), the last attempt's failure and Alan's reply if there are any, then the material
the kind of step needs:

| Kind | Material | Rules |
|---|---|---|
| spec | `GOALS.md`, the piece's docs to read | `prompts/spec.md` |
| spec-review | `GOALS.md` | `prompts/spec-review.md`, `prompts/spec.md` |
| build | the goals (without the decisions), `CODING_STANDARDS.md` | `prompts/build.md` |
| review | `GOALS.md`, `CODING_STANDARDS.md`, the diff stat since `baseSha`, the whole spec | `prompts/review.md` |

All four also get the piece's log entries and `prompts/session.md`, the rules every
session shares. The files in `prompts/` are written to the session, and each rule lives
in exactly one of them. A brief carries every part of the design its step needs, so a
build session never reads the spec.

## How a step counts

A session commits and pushes its work and a `LOG.md` entry, then reports `done`,
`pending` or `blocked` in `runs/result.json`. Only the crew changes a step's status:

- A phase 2 `done` counts once the brief's `## Acceptance` block passes when the crew runs
  it, and `ci.yml` is green on the session's last push. A red run has its failed jobs
  re-run once first, and a pass on the rerun is noted on the log issue as a flake. A
  failure goes back to the next attempt, with the failing step's log and the run's
  artifacts to download.
- Two unfinished attempts block the step. A `blocked` result, or a brief that's missing,
  blocks the piece. The crew opens an issue for it, and Alan's reply or closing the issue
  unblocks it.
- When a piece with a `release` (`minor` or `patch`) is done, the crew records it in
  `state.json`'s `release`, the larger level winning. Once the whole queue is done it runs
  `scripts/bump-version.mjs` once with that level and pushes, and `release.yml` publishes
  the build.

## Files

| File | Written by |
|---|---|
| `GOALS.md` | Alan. Sessions read it. |
| `state.json` | The crew: statuses, attempts, failures, blockers, replies, `baseSha`, the model check, `modelsChecked` and the queued `release`. Spec and spec-review sessions write their piece's `steps` and `release`. Alan sets `enabled`. |
| `LOG.md` | Every session appends one entry. Rolled when finished pieces are removed; earlier entries are in git history. |
| `specs/<piece>.md`, `specs/<piece>/<step>.md` | Phase 1 sessions. Build sessions correct them when they turn out wrong. |
| `prompts/*.md` | Alan. The rules sessions follow. |
| `runs/` | The crew and sessions: prompts, transcripts, `result.json`. Not committed. |

## Considered and declined

- **Splitting the review into a finding session and a fixing session.** One review per
  piece has been plenty, and reviewers have judged well what is substantive. The reviewer
  already holds the context and is best placed to make the fixes. Handing a list over to
  another session would cost a cold start for no gain.
