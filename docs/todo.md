# To do

Small items that don't have their own design doc yet. Larger ideas live in `docs/`.

- [x] Copy-prompt lookup, built as its own stage: replace the "Look up with Claude"
      button with Copy prompt, then paste-back JSON parsing and validation. See
      [copy-prompt-lookup.md](copy-prompt-lookup.md).
- [x] Drop the API key feature, as a separate stage after copy-prompt lookup is in place.
      Covers the Claude client, auto-refresh (`CardRefresher`), the API key setting, the
      `autoRefresh`/`refreshedOn` columns (version 3 migration), backup format, e2e
      `@live-api` scenarios, and the docs (`CLAUDE.md`, `PRIVACY.md`, `README.md`).
      See [copy-prompt-lookup.md](copy-prompt-lookup.md) for the replacement.
- [x] Word forms and multiple definitions: see [word-forms.md](word-forms.md).
- [ ] Test layers and web app: see [testing-and-web-plan.md](testing-and-web-plan.md).
- [ ] Install Matt Pocock's skills with npm/npx; the marketplace plugin is out of date.
- [ ] Use the writing-for-agents skill to tear apart `CLAUDE.md`.
- [ ] Fix the auto-mode classifier blocking the release bump properly. It denied
      `node scripts/bump-version.mjs patch` twice in `test-ui-layers/review` as a production
      deploy (see `jogging/LOG.md`, 14/10/2026).
- [ ] Opus review of the proposal, protocol and Phase 0: the step missing from Start Jogging.
- [ ] Auto-merge Dependabot's minor and patch PRs. On GitHub (owner): a ruleset on
      `main` requiring the CI checks, with Repository admin on the bypass list so direct
      pushes still work, and "Allow auto-merge" ticked; without required checks,
      auto-merge merges before CI finishes. In the repo: a `dependabot-automerge.yml`
      workflow that runs `dependabot/fetch-metadata` and `gh pr merge --auto --squash`
      unless the update is a semver major. Merges made with `GITHUB_TOKEN` don't trigger
      the `push` workflows on `main`, and CI doesn't run the Appium suite, so consider
      leaving `e2e/` npm updates manual.
