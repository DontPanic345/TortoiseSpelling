# Jogging on GitHub Actions (plan, not yet implemented)

Status: **proposal**, 15/10/2026. Items marked **(unverified)** haven't been tried.

Move the Jogging crew from the claude.ai Cloud Routine to a scheduled GitHub Actions
workflow, with an Android emulator in the same job.

## Why

Today the crew runs in a Claude cloud container. The container has no emulator, so
connected tests and e2e reach the spare Galaxy S23 at home over Tailscale (userspace
networking, a `socat` bridge, and possibly a DERP relay). Appium sends a separate request
for every find, tap, type and poll, each a round trip between the cloud and NZ, so e2e runs
about 20 times slower than on an emulator. A build step takes about an hour.

On a GitHub-hosted runner:

- **The emulator is local.** Ubuntu runners expose KVM; `ci.yml` and `release-smoke.yml`
  already boot emulators there, and `release-smoke.yml` already runs Appium against one.
- **It's free.** Standard runners cost nothing for a public repo. A job can run for up to 6
  hours.
- **Gradle stays warm.** `setup-java`'s Gradle cache survives between runs; the cloud
  container pays a cold build (about 10 minutes) every run.
- **Transcripts are kept.** `jogging/runs/` can be uploaded as a workflow artifact. Today
  it's deleted with the container.

What's lost: the real Samsung. Keep the S23 for manual checks.

## The workflow (`.github/workflows/jogging.yml`)

```yaml
name: Jogging

on:
  schedule:
    - cron: "0 */6 * * *"
  workflow_dispatch:

concurrency:
  group: jogging
  cancel-in-progress: false

permissions:
  contents: read

jobs:
  jog:
    runs-on: ubuntu-latest
    timeout-minutes: 345
    steps:
      - uses: actions/checkout@v7
        with:
          token: ${{ secrets.JOGGING_GH_TOKEN }}
      - uses: actions/setup-java@v6
        with: { distribution: temurin, java-version: "17", cache: gradle }
      - uses: actions/setup-node@v7
        with: { node-version: 22, cache: npm, cache-dependency-path: e2e/package-lock.json }
      - name: Enable KVM
        run: |
          echo 'KERNEL=="kvm", GROUP="kvm", MODE="0666", OPTIONS+="static_node=kvm"' \
            | sudo tee /etc/udev/rules.d/99-kvm4all.rules
          sudo udevadm control --reload-rules
          sudo udevadm trigger --name-match=kvm
      - run: npm install -g @anthropic-ai/claude-code && (cd e2e && npm ci)
      - name: Run the crew
        uses: reactivecircus/android-emulator-runner@v2
        env:
          CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          GH_TOKEN: ${{ secrets.JOGGING_GH_TOKEN }}
        with:
          api-level: 34
          arch: x86_64
          target: google_apis
          disable-animations: true
          script: node jogging/jog.mjs run --ci
      - uses: actions/upload-artifact@v7
        if: always()
        with:
          name: jogging-runs-${{ github.run_id }}
          path: jogging/runs/
          retention-days: 7
```

### Secrets

- `CLAUDE_CODE_OAUTH_TOKEN`: from `claude-personal setup-token`, approved in the browser as
  falloonalan@gmail.com. It's a long-lived token for the Pro subscription, so steps draw on
  the same 5-hour and weekly windows as now. Anyone holding it can use the subscription.
- `JOGGING_GH_TOKEN`: a fine-grained token for `DontPanic345/TortoiseSpelling` with contents
  read/write. The workflow's own `GITHUB_TOKEN` won't do: pushes made with it don't trigger
  other workflows, so `jogging-notify.yml`, `ci.yml` and `release.yml` would never run.

### Public repo

Workflow logs and artifacts are readable by anyone signed in to GitHub. Step transcripts go
to `jogging/runs/` and only reach the artifact, never the log; keep the artifact's
retention short. If that isn't acceptable, make the repo private, which brings Actions
minute limits back.

## Changes to `jog.mjs`

### How easy is it to extend?

Partly. The parts that don't care where they run are already separate:

- The pure logic (`pace`, `nextStep`, `parseUsage`, `stepPrompt`, `accountProblem`,
  `tokenProblem`) is exported and covered by `jog.test.mjs`.
- The lock is an object with `acquire` and `release`, so a third kind is a third object.
- Notifications go through the outbox and `jogging-notify.yml`, which work from anywhere
  that can push.
- All state is on main, so nothing needs to carry between runs.

The awkward part is that the environment is a boolean. `CLOUD` is checked in about a dozen
places: `setupEnv`, `assertIdentity`, the lock choice, the GH_TOKEN check, the prompt, the
end-of-run report, `disableTask`, the crash report and `status`. Adding a third environment
as another boolean would double those branches.

### The refactor

Replace `CLOUD` with one environment object per mode, picked from the command line:

```js
const ENVS = {
    local: { setupEnv, assertIdentity, lock: localLock, unattended: false, promptNote: "" },
    cloud: { …, lock: cloudLock, unattended: true, promptNote: `…"In the cloud" rules.` },
    ci:    { …, lock: noLock, unattended: true, promptNote: `…"In CI" rules.` },
};
```

The `ci` entry:

- **Lock:** none. The workflow's `concurrency` group already stops overlapping runs.
- **Environment:** keep `CLAUDE_CODE_OAUTH_TOKEN` (the local mode deletes it as an auth
  override). `ANDROID_SERIAL` comes from the emulator runner; `JAVA_HOME` and
  `ANDROID_HOME` from the runner image.
- **Identity:** `accountProblem` checks the config directory and `authMethod: "claude.ai"`.
  A token login reports differently **(unverified)**, so CI needs its own check that still
  requires falloonalan@gmail.com. Git's `user.email` is set in the workflow, and
  `tokenProblem` checks `JOGGING_GH_TOKEN` as the cloud mode does now.
- **Deadline:** the job is killed at 6 hours. `runSteps` should stop starting new steps
  after about 4.5 hours, since a step can take an hour.

### Pausing and restarting

Alan must be able to pause Jogging and restart it gracefully, without losing work or leaving
main in a state the next run trips over:

- **Pause after the current step.** Pushing `"enabled": false` in `state.json` lets the
  running step finish and commit, then stops the crew before the next one. Today a push
  that lands between the crew's pull and its push makes the push fail and the run crash;
  the crew should rebase its state commit and carry on to the stop.
- **Stop now.** Cancelling the run from the Actions tab kills the step mid-way. The step
  must stay `pending` (not counted as an attempt), and the next run starts it again from
  whatever the session had pushed.
- **Restart.** Setting `enabled` back to true, then dispatching the workflow or waiting for
  the schedule, picks up from `state.json` with nothing else to undo.
- Disabling the workflow (`gh workflow disable jogging.yml`) stops the schedule but not a
  run in progress; the docs should say which control does what.

### Usage pacing

`usage.py` reads the OAuth access token from `.credentials.json`, which doesn't exist with
a setup token. It needs to try `CLAUDE_CODE_OAUTH_TOKEN` first. Whether the usage endpoint
accepts a setup token is **(unverified)**; if it doesn't, the probe route (a minimal model
call that reads the rate-limit headers) is the fallback.

### The step prompt (phase 2)

Today a session gets a short prompt telling it which files to read, and spends its first
turns working out where to look. A phase 2 session should instead start with its goal and
what serves it, and nothing else. Curated, not whole files: anything irrelevant costs
reasoning, and other steps' instructions invite work outside the step.

| Step | Goal, first | Material | Rules from `PROTOCOL.md` |
|---|---|---|---|
| build | its spec section | the Design subsections its `Reads:` line names; this piece's log entries | build step, the environment's paragraph, finishing, blockers |
| review | its spec section | the whole spec, `GOALS.md`, this piece's log entries | review step, the environment's paragraph, finishing, blockers |

- Not included: `GOALS.md` for a build step (the spec has already applied it), other
  pieces' log entries, the `state.json` dump, and the spec's other build steps and "What
  later pieces rely on".
- `CLAUDE.md` is loaded by `claude -p` already.
- The prompt goes on stdin; a whole spec doesn't fit on a Windows command line. Save it
  beside the transcript in `jogging/runs/`.
- Phase 1 keeps today's prompt: those steps run on Opus, which reads everything anyway.
- The prompt builder stays pure (it takes the file contents) and is unit-tested: section
  extraction, a missing `Reads:` section failing loudly, and the goal coming first.

**Specs.** Each build step gets a `Reads:` line naming the Design subsections it needs, e.g.
`Reads: Design › App code, Design › Settings`. The spec step's rules ask for it from now
on, and the pending pieces' specs (web-core, web-ui, shared-specs, web-push; 20 build
steps) get it in a one-off edit before the first CI run.

## Changes to `PROTOCOL.md`

- One heading per step type, plus shared "Finishing" and "Blockers" sections, so the crew
  can pick the ones a step needs by heading.
- Add an "In CI" paragraph beside "In the cloud": the emulator is already running, so don't
  start or kill one; e2e runs at emulator speed. The rule that build steps run only the e2e
  features their spec names stays, because it's about what's worth testing, not speed.
- The spec step writes a `Reads:` line for each build step.

## Rollout

1. Create both secrets.
2. Confirm `usage.py` can read the windows with the setup token, from a one-off
   `workflow_dispatch` run that runs `node jogging/jog.mjs status --ci`.
3. Do the `jog.mjs` refactor with tests, then add the `ci` mode and `jogging.yml`.
   Restructure `PROTOCOL.md`, add the `Reads:` lines to the pending specs, and switch
   phase 2 to the curated prompt.
4. Dispatch one run by hand and let it finish a step.
5. Disable the "Jogging" Cloud Routine. `cloud-setup.sh` and the cloud mode can go once CI
   has run for a week without trouble.
