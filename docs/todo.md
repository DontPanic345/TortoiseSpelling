# To do

- [ ] Use the writing-for-agents skill to tear apart `CLAUDE.md`.
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
