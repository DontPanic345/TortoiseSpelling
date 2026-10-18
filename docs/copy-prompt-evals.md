# Copy prompt evals on local models

A plan for testing the copy prompt (`lookupPrompt`) against small open-source models on a
laptop (32 GB RAM, about 1 TB disk), so the prompt stays one that simple models can follow.
Not started: it waits until the word forms have been tried by hand. The earlier manual runs
are in [`evals/copy-prompt/`](../evals/copy-prompt/README.md); nothing here runs in CI.

## Questions

- Does the reply paste? If not, is it broken JSON, the wrong shape, or a rule the parser
  enforces (a definition using the word, an example missing its form)?
- Does the model fix its reply when given the **Copy error** message?
- Does it pad thin words with rare senses, possessives or made-up forms?
- Does it merge genuine forms that share a spelling (sheep singular and plural, read present
  and past) into one "singular or plural" form? Separate forms are wanted: each gives the
  word another context.
- Does it correct a misspelling, and leave British or American spelling alone?

## Model server

[Ollama](https://ollama.com), which runs natively on Windows and serves an HTTP API on
`localhost:11434`. Each request has no system prompt, the default temperature and a fixed
`seed`, so it is close to a fresh chat and repeatable. Record the model digest and Ollama
version with every run. LM Studio's OpenAI-compatible server would also do.

## Models

Three tiers, all 4-bit, about 80–100 GB in total. Check Ollama's library for current tags.

| Tier | Examples | Disk each |
|---|---|---|
| Tiny | Qwen 2.5 1.5B, Llama 3.2 3B, Gemma 3 4B, Phi-4 mini | 1–3 GB |
| Small | Qwen3 8B, Llama 3.1 8B, Gemma 3 12B | 5–8 GB |
| Mid | GLM 4.7 Flash, gpt-oss 20B, Mistral Small 24B, Qwen3 14B or 30B-A3B | 12–18 GB |

The tiny tier is the test that matters; the mid tier shows what a capable local model does.

## Words

About 20, each picked to test something. Run each model on each word three times, since
the open questions are about repeatability.

| Tests | Words |
|---|---|
| Forms that share a spelling | sheep, read, fish, deer, cut |
| Few forms (padding) | necessary, rhythm, thorough, information |
| Several senses | calendar, bank, practice, lie |
| Irregular forms | knife, mouse, bury |
| Misspelt, should be fixed | recieve, accomodate |
| Spelling to keep | colour, color, sceptical |
| Long or rare | phenomenon, queue, analysis |

## Runner: `evals/copy-prompt/run.ts`

- Builds the prompt with `lookupPrompt` from `web/src/domain`, so it always tests the shipped
  prompt. `--prompt variants/<name>.txt` tries a candidate wording (with `$word` in it)
  without touching the apps.
- Writes `runs/<variant>/<model>/<word>-<n>.txt`, and `meta.json` with the model digest,
  options, seed and a hash of the prompt.
- Skips replies that already exist, so a run can be stopped and resumed overnight.
- **Repair round**: when `parsePastedLookup` rejects a reply, it sends the error message
  Copy error would copy as the next turn of the same chat, and saves the answer as
  `<word>-<n>.repair.txt`.

It replaces `gen.ts` and the scripts that hard-code their folder.

## Scorer: `evals/copy-prompt/score.ts`

Per reply:

- **Pastes**: `parsePastedLookup(text, word)` and its message; the pass rate after repair.
- **Wrapping**: code fence, prose around the JSON, markdown backslashes.
- **Word**: corrected when misspelt, kept when it shouldn't change.
- **Counts**: definitions, forms and sentences, against "about a dozen" sentences.
- **Rules**: a definition using a form of the word, 25 words or more, the first form not
  being the word.
- **Merged forms**: a label with "or" or "/" in it, such as "singular or plural".
- **Likely padding**: possessives, a label repeated within a definition, an -ing form
  labelled "noun".
- **Limits**: anything over `PasteLimits`.

It writes `runs/<variant>/summary.md`: a row per model with the pass rate, the pass rate after
repair, average counts and flags, then the flagged replies to read.

## Human review

A script can't judge invented senses or plain language. `blind.ts` shows two or three words
from two models side by side in random order, with `blind-key.txt` saying which was which, as
in the Haiku against Sonnet comparison. Ten minutes per comparison is enough.

## Order

1. **Baseline**: the current prompt, every model, every word, three times. About 600 replies;
   tiny models take seconds each and 20B+ ones up to a minute on CPU, so run it overnight.
2. **Read the summary**: where do small models fail — JSON, rules or content?
3. **Variants**: only for failures the baseline shows, one change each, run on the affected
   words and the tiny tier.
4. **Ship a winner** in both apps with `golden/prompt.json`, the tests, the spec and the
   changelog, then re-run the baseline for the record.

## What's committed

The scripts, the variant prompts, the raw replies (a few KB each) and each `summary.md`;
never the models. `out/`, `out2/` and `out3/` stay as history.
