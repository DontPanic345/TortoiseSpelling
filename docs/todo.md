# To do

- [x] Use the writing-for-agents skill to tear apart `CLAUDE.md`.
- [ ] Auto-merge Dependabot's minor and patch PRs. On GitHub (owner): a ruleset on
  `main` requiring the CI checks, with Repository admin on the bypass list so direct
  pushes still work, and "Allow auto-merge" ticked; without required checks,
  auto-merge merges before CI finishes. In the repo: a `dependabot-automerge.yml`
  workflow that runs `dependabot/fetch-metadata` and `gh pr merge --auto --squash`
  unless the update is a semver major. Merges made with `GITHUB_TOKEN` don't trigger
  the `push` workflows on `main`, and CI doesn't run the Appium suite, so consider
  leaving `e2e/` npm updates manual.
- [ ] Copy prompt evals on local models, once the word forms have been tried by hand: see
  [copy-prompt-evals.md](copy-prompt-evals.md).
- [ ] Retro on some of the Jogging build steps' transcripts: what went well, what wasted
  time, and what to change in `jogging/PROTOCOL.md`. The transcripts are workflow
  artifacts kept for seven days, so pick the runs before they expire.
- [ ] Rebuild the app icon with an external image service (to be chosen; ElevenLabs came
  up, but it makes audio, not images). Today the icon is drawn by `scripts/icon.mjs` and
  `icon.test.mjs` checks the committed files match, so decide how a bought-in image fits
  that pipeline, and keep the adaptive and monochrome layers and the notification icon.
- [x] Look at Matt Pocock's `improve-codebase-architecture` skill and whether it suits this
  repo. It does: its first run's top candidate became the `review-outcome` Jogging piece.
