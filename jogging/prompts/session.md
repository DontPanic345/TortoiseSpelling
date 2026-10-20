# Every Jogging session

## The runner

- An API 34 emulator is running and `ANDROID_SERIAL` points at it: use it as it is.
  Connected tests and e2e run at emulator speed.
- Every e2e failure is real: find its cause.
- `JAVA_HOME`, `ANDROID_HOME` and a throwaway release signing key (the `RELEASE_*`
  variables) are set, so `./gradlew assembleRelease` works as it is.
- The crew stops a session after 90 minutes. Commit work that passes its checks as you go.
- Anyone signed in to GitHub can read your transcript for seven days. Never print secrets
  or the environment.

## Open questions and blockers

Settle open questions yourself with the goals and the spec, and note the choice in the
spec or the log.

A **blocker** makes progress on the piece impossible: an account, secret or physical
action only Alan can supply, a contradiction between goals, or a check that can't pass for
reasons outside the piece. Log it, push, and finish with a `blocked` result. That result
is how you reach Alan: the crew opens an issue for it, and his reply comes to the next
session.

## Finishing

1. Append to `jogging/LOG.md`: `## <YYYY-MM-DD HH:MM> <piece>/<step> (<model>)` and two
   or three lines on the outcome.
2. Commit everything with a message naming the piece and step, and push. The crew owns
   every `status` in `state.json`.
3. Write `jogging/runs/result.json` (not committed), with one of:
   - `{"status": "done"}`: the step is finished and pushed. Finish as soon as your push
     lands. For a build or review step the crew then runs the brief's Acceptance block
     and waits for `ci.yml`, and a failure comes back to the next attempt.
   - `{"status": "pending", "note": "<where the next session picks up>"}`: you ran out of
     room. Push what passes its checks first. Two unfinished attempts block the step.
   - `{"status": "blocked", "blocker": "<what Alan must supply, in one or two sentences>"}`.
