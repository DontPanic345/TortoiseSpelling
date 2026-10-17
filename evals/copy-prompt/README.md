# Copy prompt evals

How chat models answer the copy prompt (`lookupPrompt`) and whether `parsePastedLookup` accepts
the reply. Nothing here runs in CI; it is a record of manual runs.

- `gen.ts` writes `prompts/<word>.txt` from the current prompt.
- `out/`, `out2/`, `out3/` hold raw replies, named `<model>[-<effort>]-<word>.txt`. They were
  produced by giving each prompt to a model with no other context. `out2/` is Haiku and
  Sonnet at low, medium and high effort on fish, sheep, read, analysis and knife; `out3/` is
  Haiku low with the plain-language rule added.
- `score.ts` and `score2.mjs` parse each reply and count forms and examples; `fish.mjs`,
  `rules.mjs` and `cmp.mjs` check specific behaviours; `blind.mjs` and `blind-key.txt` are the
  Haiku low against Sonnet high blind comparison.
- `glm-calendar.txt` is a GLM 4.7 Flash reply with a missing `]`, which the parser rejects.

Run a script from the repo root, for example
`npx --prefix web tsx evals/copy-prompt/score.ts`. Some scripts hard-code their folder.
