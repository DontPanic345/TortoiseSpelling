# Jogging protocol

Jogging works through The Work one step at a time, in cold sessions. `jogging/jog.mjs`
(the support crew) picks the next step, checks the budget, and starts one `claude -p`
session per step with the model and effort the step names. That session is you. The
crew runs in GitHub Actions (`.github/workflows/jogging.yml`) every six hours.

You have no context beyond the repo and your prompt. `CLAUDE.md` is already loaded. A
phase 1 session reads `jogging/GOALS.md`, its piece in `jogging/state.json` and the end of
`jogging/LOG.md`. A phase 2 session's prompt already holds what its step needs: its spec
section, the design it reads, the piece's log and the rules below that apply to it. Do
**only the step you were given**, and finish as "Finishing a step" says.

## Files

| File | Who writes it |
|---|---|
| `GOALS.md` | Alan. Read-only for sessions. |
| `state.json` | The crew: every step's and piece's status, attempts, blockers, replies, CI failures and the piece's base commit. A `spec` or `spec-review` session adds or edits its piece's `steps`, and nothing else. Alan sets `enabled`. |
| `LOG.md` | Every session appends one entry. |
| `specs/<piece>.md` | Phase 1 sessions; Phase 2 sessions may correct them. |
| `runs/result.json` | Every session, last: how the step ended. Not committed. |
| `runs/*.prompt.md` | The crew: each phase 2 session's prompt, beside its transcript. Not committed. |

## Phase 1: specification

Specs are written for every piece before any building starts. A later spec can assume
earlier pieces are built as specified.

### Spec step

Opus. Write `specs/<piece>.md` from the piece's `docs` and the code as it is now. It must
contain:

- What the piece delivers, and which goals and decisions it leans on.
- The design under `## Design`, one `###` subsection per area: data model, screens, files
  touched, migrations, docs to update (`CLAUDE.md`, `README.md`, `PRIVACY.md`,
  `CHANGELOG.md`).
- **Build steps** under `## Build steps`, one `### <id>: <title>` heading each, small
  enough for one session. Shared abbreviations go between `## Build steps` and the first
  step. Every step has:
  - a `Reads:` line naming the Design subsections its session needs, e.g.
    `Reads: Design › Android, Design › Docs`. The crew puts only those in the session's
    prompt, so name every one the step touches.
  - a runnable acceptance check: the exact commands, including the e2e features the step
    touches, and what passing looks like. Leave `ci.yml` out: the crew gates every step on
    it.
- The **model and effort** for each build step and for the final `### review` step, each
  with a one-line reason in the spec. No model is the default: size each step to its work,
  with the budget in mind. Opus fits a step, or the review of a piece, that touches goals
  1 or 2 (data, the reminder), must keep both apps in agreement, involves concurrency or
  transactions, or is large (many build steps or layers at once). Sonnet fits a contained
  step or a small piece's review. Haiku fits mechanical work with an exact check.
- What a later piece will rely on (for pieces listed as depending on this one).

Then append the build steps and the review step to the piece's `steps` in `state.json`:

```json
{ "id": "build-1", "phase": 2, "title": "…", "model": "sonnet", "effort": "medium", "status": "pending" }
```

The last step is `{ "id": "review", "phase": 2, … }`.

### Spec-review step

Opus. Review the spec as an independent reader against the goals, the decisions and the
code, and check every build step has a `Reads:` line that covers what it touches. Apply
every substantive finding to the spec and to its steps in `state.json` yourself. Leave
style nits alone.

## Phase 2: build

### Build step

Do exactly what your spec section says, then run its acceptance check. Follow
`CLAUDE.md`'s Workflow: unit tests and lint, and the e2e features your change touches. Add
a `CHANGELOG.md` line for user-visible changes. Commit and push when the check passes.

If the spec turns out wrong, fix the spec in the same commit and say so in the log.

If your prompt has a CI failure from the last attempt, fixing it comes first.

### Review step

Review the whole piece as built, independently, against its spec, the goals and
`CODING_STANDARDS.md`. Your prompt has the piece's base commit and the files it changed:
read the diff (`git diff <base>..HEAD -- <path>`), not only the spec and the tests. Fix
substantive findings yourself, each with a test that fails without the fix; leave nits.

CI runs every suite on each push, the e2e suite included, so don't re-run them. Run the
tests for what you change, and what CI can't run: when the piece changes the Android app,
the release smoke on a release build (`npm run e2e:release`, see `e2e/README.md`). If the
piece changes the Android app for users, finish with the release bump from `GOALS.md`.

## In CI

- An emulator (API 34) is already running and `ANDROID_SERIAL` points at it. Don't start
  or kill one. Connected tests and e2e run at emulator speed.
- A failing e2e step is a failure. There's no list of known flaky steps; if one fails,
  find out why.
- `JAVA_HOME` and `ANDROID_HOME` are set, and the `RELEASE_*` variables point at a
  throwaway signing key, so `./gradlew assembleRelease` works as it is. `gh` is signed in
  as `DontPanic345`.
- Don't wait on CI. After you finish, the crew waits for `ci.yml` on your last push and
  marks the step done only when it's green; a red run sends the step back, with the
  failure, to the next attempt.
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

No `result.json`, or a session that crashes, counts as pending. So does a `done` whose
`ci.yml` run is red.

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
