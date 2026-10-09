# To do

Small items that don't have their own design doc yet. Larger ideas live in `docs/`.

- [ ] Rebuild the app icon. Generate it with Pillow (or another tool) so it can be
      re-run and tweaked, rather than hand-drawn.
- [ ] Copy-prompt lookup, built as its own stage: replace the "Look up with Claude"
      button with Copy prompt, then paste-back JSON parsing and validation. See
      [copy-prompt-lookup.md](copy-prompt-lookup.md).
- [ ] Drop the API key feature, as a separate stage after copy-prompt lookup is in place.
      Covers the Claude client, auto-refresh (`CardRefresher`), the API key setting, the
      `autoRefresh`/`refreshedOn` columns (version 3 migration), backup format, e2e
      `@live-api` scenarios, and the docs (`CLAUDE.md`, `PRIVACY.md`, `README.md`).
      See [copy-prompt-lookup.md](copy-prompt-lookup.md) for the replacement.
- [ ] Word forms and multiple definitions: see [word-forms.md](word-forms.md).
- [ ] Test layers and web app: see [testing-and-web-plan.md](testing-and-web-plan.md).
