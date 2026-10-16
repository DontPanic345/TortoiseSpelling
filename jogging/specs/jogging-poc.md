# Jogging PoC: proof that Jogging runs on GitHub Actions

Infrastructure, not part of The Work (`GOALS.md`, "Jogging on Actions"). It runs before
the real pieces, cheaply, on Sonnet at low effort, and proves two things the move from
the Cloud Routine depends on:

1. The runner can do a build step: emulator, Gradle, Appium and push all work, and fast.
2. The blocker round trip works: a blocker opens an issue that reaches Alan's phone, his
   reply on the issue unblocks the piece, and the next session gets the reply.

Each step writes into `jogging/poc.md`, a scratch record that stays in the repo as
evidence. No app code, no `CHANGELOG.md` line, no version bump.

Both steps first ran on Haiku and ended within minutes, twice: Haiku has no auto mode, so
the sessions fell back to default mode and every command was refused. The crew now
refuses such a session before it begins.

## Build steps

### build-1: runner check (sonnet, low)

Create `jogging/poc.md` with a `## Runner check` section. For each command below, record
the command, whether it passed, and how long it took (time it with `time` or `date +%s`):

1. `adb devices` and `adb shell getprop ro.build.version.release` (expect one emulator,
   Android 14).
2. `./gradlew testDebugUnitTest --tests '*DaysTest'`
3. `./gradlew assembleDebug`
4. From `e2e/`: `npm run e2e -- --spec features/settings.feature`

Acceptance: all four pass and `poc.md` lists the times. If one fails for a reason outside
this repo's code (no emulator, Appium can't start), that's a blocker: say which command
and the error. Commit and push.

### build-2: blocker round trip (sonnet, low)

This step deliberately blocks once.

- **If your prompt has no reply from Alan:** append a `## Blocker round trip` section to
  `poc.md` saying the blocker was raised and when, push, and end with a `blocked` result
  whose blocker is: `Jogging PoC: reply on this issue with any word (from your phone, if
  you can) to prove the round trip works.`
- **If your prompt has Alan's reply:** add the word he gave, and the time you read it,
  under that section. Push, and end with `done`.

Acceptance: `poc.md` has the raised time, the word and the read time.
