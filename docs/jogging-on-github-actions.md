# Jogging on GitHub Actions

Status: **built and running**; the `jogging-poc` piece proved it on the runner. Items
marked **(unverified)** haven't run on GitHub yet. How pieces, steps and prompts work:
[`jogging/README.md`](../jogging/README.md).

Jogging runs from a scheduled workflow, `.github/workflows/jogging.yml`, with an Android
emulator in the same job. The Cloud Routine (which drove the spare Galaxy S23 over
Tailscale) and the Windows scheduled task are gone, and so is their code: `--cloud`, the
cloud lock, `cloud-setup.sh`, `install-task.ps1`, the Maven mirror and the spike notes.

## Why

The cloud container had no emulator, so every Appium call crossed Tailscale to NZ and e2e
ran about 20 times slower; a build step took about an hour, and the review steps learned
to accept "known" link failures. On a GitHub-hosted runner the emulator is local (Ubuntu
runners expose KVM; `release-smoke.yml` already runs Appium there), standard runners are
free for a public repo, a job can run for 6 hours, and `setup-java` keeps Gradle warm.

What's lost: the real Samsung. Keep the S23 for manual checks.

## How a run goes

1. The schedule (every six hours) or a manual dispatch starts the job. The `jogging`
   concurrency group never runs two at once.
2. The job checks out with `JOGGING_GH_TOKEN`, installs Claude Code (pinned), Java, Node
   and the e2e packages, boots an API 34 emulator and runs `node jogging/jog.mjs run`.
3. The crew picks up replies on blocker issues, then loops: pull, check `enabled`, the
   deadline and the budget (`usage.py`), start the next step's session, read its
   `jogging/runs/result.json`, record the outcome in `state.json` and push.
4. It stops on a budget stop, after 250 minutes (no new step), when every piece is done
   (it disables the workflow), or when everything left is blocked.
5. Transcripts go up as a workflow artifact for seven days. A run that fails, is cancelled
   or times out comments on the log issue from a final `if: failure() || cancelled()` step.

## Design decisions (and what they fixed)

- **The crew is the only writer of status.** Sessions commit their work and the log entry,
  then report `done`, `pending` or `blocked` in `runs/result.json`. Only `spec` and
  `spec-review` sessions touch `state.json`, to write their piece's steps. This removed the
  push races between sessions and the crew.
- **Notifications go straight to GitHub issues** with the workflow's own token, so they come
  from github-actions[bot] and notify Alan on GitHub Mobile. The issue number comes back
  from the create call. This replaced `outbox.jsonl`, `jogging-notify.yml`, the
  five-minute `findIssue` polling (whose 401 crashed the run that raised the
  test-ui-layers blocker) and a crew commit per message.
- **Blocker fields are cleared on unblock** (`blockerIssue`, `blockedAt`, and the steps'
  `attempts`), so a piece blocked a second time gets a new issue. Before, it kept the old
  issue number, never got a new issue, and unblocked itself on the old closed issue.
- **Every session that doesn't finish counts as an attempt,** crashes and timeouts
  included; two attempts block the step. A cancelled run never gets that far, so
  cancelling doesn't cost an attempt.
- **Every push rebases** (with retries), so Alan can push to main, including a pause, while
  a run is going.
- **Each session has a 90-minute timeout,** and no step starts after 250 minutes, so the
  crew always records the last step before the 345-minute job limit.
- **Secrets are redacted from transcripts** (the artifact is readable by anyone signed in).
- **No identity checks.** They guarded against the work account on the same PC. A runner
  only has the secrets put there.
- **The crew checks CI, not the sessions.** A phase 2 step that reports `done` after
  pushing waits (`awaitingCi`) until `ci.yml` finishes on its last push; green finishes
  it, red sends it back with the failed jobs and their log tails (`ciFailure`) as an
  attempt. Sessions had been polling CI themselves, with blocked `sleep`s and dozens of
  Monitor timers, and some builds never looked.
- **The crew writes every prompt.** It builds each session's whole prompt (on stdin, saved
  as `runs/*.prompt.md`) from the step's brief and the `jogging/prompts/` files for its
  kind of step. Sessions had been loading 50–80KB of protocol, spec and log to get
  started; a build prompt is now 9–13KB. Briefs are written by the spec step and checked
  by spec-review, so what is reviewed is what a session reads. They replaced the crew
  cutting spec sections out by a `Reads:` line.
- **The crew runs the Acceptance block.** A brief's `## Acceptance` holds only what
  `ci.yml` can't run (a release build, the release smoke, a grep). The crew runs it after
  a session reports `done` and before the CI wait, so a session's word is never the
  check.
- **The crew bumps the version.** A piece's `release` (`minor` or `patch`) is set by its
  spec; once the piece is done the crew runs `bump-version.mjs` and pushes. The bump had
  been the review session's last chore, which pulled the session towards finishing.
- **Claude Code is pinned** (`@anthropic-ai/claude-code@2.1.301`): the crew reads its
  stream-json output (the `init` frame's model and permission mode), and model aliases
  move between versions: in 2.1.292 `haiku` meant Haiku 4.5, which gets no auto mode.
  An upgrade is a deliberate edit.

## Controls

| To                           | Do                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------- |
| Pause after the current step | Push `"enabled": false` in `jogging/state.json`                                  |
| Stop now                     | Cancel the run in the Actions tab; the step stays pending and is redone next run |
| Stop the schedule            | Disable the Jogging workflow (Actions tab)                                       |
| Restart                      | `"enabled": true`, enable the workflow, then dispatch it or wait                 |
| Check without running        | Dispatch with `command: status`                                                  |
| Unblock a piece              | Comment on its blocker issue, or close it                                        |

## Secrets

- `CLAUDE_CODE_OAUTH_TOKEN`: from `claude setup-token`, approved in the browser as
  falloonalan@gmail.com. A long-lived token for the subscription, so steps draw on the
  same 5-hour and weekly windows. Anyone holding it can use the subscription.
- `JOGGING_GH_TOKEN`: a fine-grained token for `DontPanic345/TortoiseSpelling` with
  Contents read/write and Actions read (so a session can read a failed CI run). Pushes made with
  the workflow's own `GITHUB_TOKEN` wouldn't trigger `ci.yml` or `release.yml`.

## Unverified

- Whether `usage.py`'s direct route accepts a setup token **(unverified)**. If not, it
  falls back to the probe route (a one-word Haiku call that reads the rate-limit frame).
- A whole run of real steps fitting the runner's disk and memory **(unverified)**;
  `jogging-poc/build-1` times the basics.

## Rollout

1. Create both secrets.
2. Dispatch with `command: status`: proves the token, `usage.py` and `nextStep`.
3. Dispatch with `run`. `jogging-poc/build-1` checks the runner; `build-2` blocks and opens
   an issue. Reply to it from the phone.
4. The next run (dispatch, or wait) picks up the reply, finishes the PoC and goes on to
   `drop-api-key/review`.
