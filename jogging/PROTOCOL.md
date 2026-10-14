# Jogging protocol

Jogging works through The Work one step at a time, in cold sessions. `jogging/jog.mjs`
(the support crew) picks the next step, checks the budget, and starts one `claude -p`
session per step with the model and effort the step names. That session is you. The
crew runs from a Cloud Routine four times a day.

You have no context beyond the repo. Read `CLAUDE.md`, `jogging/GOALS.md`, your piece in
`jogging/state.json`, and the end of `jogging/LOG.md`. Then do **only the step you were
given** and finish by updating the state.

## Files

| File | Who writes it |
|---|---|
| `GOALS.md` | Alan. Read-only for sessions. |
| `state.json` | Sessions mark their own step; the crew records issues and attempts. |
| `LOG.md` | Every session appends one entry. |
| `specs/<piece>.md` | Phase 1 sessions; Phase 2 sessions may correct them. |

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
  to Sonnet; use Haiku for mechanical work. Opus needs a one-line justification in the
  spec, review steps included.
- What a later piece will rely on (for pieces listed as depending on this one).

Then append the build steps and the review step to the piece's `steps` in `state.json`:

```json
{ "id": "build-1", "phase": 2, "title": "…", "model": "sonnet", "effort": "medium", "status": "pending" }
```

The last step is `{ "id": "review", "phase": 2, … }`. Commit and push.

**`spec-review` step (Opus).** Review the spec as an independent reader against the goals,
the decisions and the code. Apply every substantive finding to the spec and to its steps
in `state.json` yourself. Leave style nits alone. Commit and push.

Specs are written for every piece before any building starts. A later spec can assume
earlier pieces are built as specified.

## Phase 2: build

**Build step.** Do exactly what the step in the spec says, then run its acceptance check.
Follow `CLAUDE.md`'s Workflow for unit tests and lint, but run only the e2e features the
acceptance check names, and none if it names none. Start the emulator if `adb devices` lists none
(`emulator -avd Medium_Phone -no-window -no-audio`, from `$ANDROID_HOME/emulator`) and
stop it when you're done (`adb emu kill`). Add a `CHANGELOG.md` line for user-visible
changes. Commit and push when the check passes.

If the spec turns out wrong, fix the spec in the same commit and say so in the log.

**In the cloud.** A Cloud Routine runs the crew with `--cloud`; your prompt says so.
There's no emulator: `ANDROID_SERIAL` points at a real phone (a Galaxy S23) over
Tailscale, and e2e and connected tests run on it. Every Appium call crosses the link, so
e2e runs about 20 times slower than on an emulator.
Don't wait on the phone forever: if `adb devices` doesn't list it, rerun
`bash jogging/cloud-setup.sh`, and if that fails, it's a blocker. Never run
`adb emu kill`.

**`review` step.** Review the whole piece as built, independently, against its spec and
the goals. Run the full checks again. Fix substantive findings yourself; leave nits.
If the piece changes the Android app for users, finish with the release bump from
`GOALS.md`. Commit and push.

## Finishing a step

1. Set your step's `status` to `"done"` in `state.json`. When it's the piece's last step,
   set the piece's `status` to `"done"` too.
2. Append to `LOG.md`:
   `## <YYYY-MM-DD HH:MM> <piece>/<step> (<model>)` and two or three lines on the outcome.
3. Commit everything with a message naming the piece and step, and push.

If you run out of room mid-step, commit any work that passes its checks, leave the step
`pending`, and note in the log where the next session should pick up.

## Blockers

Open questions are usually noise; settle them with `GOALS.md` and move on, noting the
choice in the spec or the log.

A **blocker** is something that makes progress on the piece impossible: an account,
secret or physical action only Alan can supply, a contradiction between goals, or a check
that can't pass for reasons outside the piece. For a blocker:

1. Set the step's `status` to `"blocked"` and the piece's to `"blocked"`, and add
   `"blocker": "<what is needed from Alan, in one or two sentences>"` to the piece.
2. Log it, commit and push. The crew opens a GitHub issue for it.

When Alan replies, the crew unblocks the piece and passes his reply to the next session
as `userReply` on the piece. Read it, act on it, then remove `userReply`.

Don't message Alan any other way, and don't create issues yourself.
