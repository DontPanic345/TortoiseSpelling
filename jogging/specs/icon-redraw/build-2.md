# icon-redraw/build-2: Refine the chosen direction; Alan picks the final

## Alan's choice

Direction **b**, friendly cartoon, smiling: specifically `b-02` and `b-04`
(`docs/icon-concepts/explore/b-02.svg`, `docs/icon-concepts/explore/b-04.svg`). Refine from
those two; the other b images (`b-01`, `b-03`) weren't picked. The explore prompt, on
`recraftv4_1_vector` with `--colors "#2F5D50,#E7BE8A,#F7F4EE"`:

> App icon: a friendly, cheerful cartoon tortoise in three-quarter view with a big round head, a gentle smile and a dot eye, chunky rounded shapes, a high domed shell with three or four big soft plates. Single app icon, centred, on a plain flat background, a small number of flat shapes, no gradients, no shading, no text, no thin outlines. Palette: evergreen #2F5D50 background, shell amber #E7BE8A, parchment #F7F4EE skin.

His reply, verbatim: "B-02, B-04"

build-1 generated a first round of icon styles with Recraft and Alan picked a direction;
his choice is under "Alan's choice" below (build-1 writes it there). This step runs two
refining rounds within that direction, builds a finalists sheet, and ends `blocked` so
Alan can pick the final. When his reply comes back to this step, it writes his choice into
the next briefs and finishes `done`.

**If "Alan's choice" below says he chose the fallback, do only what it says.** Then,
**check whether Alan has replied.** If your prompt holds "Alan's reply to this
piece's blocker", skip to "After Alan's reply". If there is no "Alan's choice" section
here, build-1 didn't finish: finish `blocked` saying so.

Recraft is paid, allowed for this piece only, with a hard cap of 10,000 units across the
whole piece; `scripts/recraft.mjs` keeps the total in `docs/icon-concepts/log.json` and
refuses a request that would pass it. The token is in `RECRAFT_API_TOKEN`: never print
it, request headers or the environment.

## Tools (from build-1)

- `node scripts/recraft.mjs generate --round <round> --direction <letter> --n <n> --prompt "…" [--style …] [--model …] [--colors "#2F5D50,#E7BE8A,#F7F4EE"]`
  (default model `recraftv4_1_vector`; `--colors` passes the palette as `controls.colors`)
  saves SVGs as `docs/icon-concepts/<round>/<direction>-<nn>.svg` and records the request.
- `node scripts/recraft.mjs spent` prints spent and cap; `check` verifies the ledger.
- `cd web && node scripts/icon-sheet.mjs <round>` renders the round's SVGs (minus those
  in `docs/icon-concepts/<round>/dropped.json`) to `docs/icon-concepts/<round>/sheet.png`:
  each at 432 px masked on Evergreen, 48 px masked, and 24 px as a white silhouette, with
  the placeholder in a corner. Look at sheets with the Read tool.

If a tool is missing or broken, fix it (build-1's brief is `jogging/specs/icon-redraw/build-1.md`).

## The rounds

Use round names `refine-1` and `refine-2`. Each is about 12 images in the chosen direction.
Before round 2, look at round 1's sheet and tighten the prompt against the criteria: say
what to keep, what to simplify, what failed at 24 px. Check `spent` before each request;
together the rounds should stay under about 2,500 units.

| Criterion | Pass looks like |
|---|---|
| Quality | At least as polished as the placeholder side by side, at every size. |
| Reads at 48 dp | Recognisable at launcher size on a phone home screen. |
| Silhouette at 24 dp | Still reads as one white shape in the status bar; internal gaps don't fill in. |
| Safe zone | The art fills most of the 66 dp safe circle and no mask crops anything important. |
| Monochrome | Its key details survive when every part is one colour. |
| Fits the app | Sits with the app's palette (Evergreen `#2F5D50`, shell amber `#E7BE8A`, Parchment `#F7F4EE`) or proposes a better one. |
| Buildable | Can be rebuilt as a modest number of clean paths. No gradients, textures or hairlines. |

The final will be rebuilt by hand as clean paths (`M L H V C Q Z` only, every gap an
absence of paint, gaps at least 3 units in a 108 canvas), so favour designs that survive
that: few parts, bold gaps, no fine detail.

## The finalists

Choose three to five from both rounds. Copy each to `docs/icon-concepts/finalists/1.svg`
… `5.svg` and render `cd web && node scripts/icon-sheet.mjs finalists`, so each sits beside the placeholder at all three sizes, numbered. Add the rounds'
prompts and the finalists (number, source file, one phrase) to `docs/icon-concepts/README.md`.

Commit and push, log, then finish `blocked` with:

"Pick the final: https://github.com/DontPanic345/TortoiseSpelling/blob/main/docs/icon-concepts/finalists/sheet.png (details in docs/icon-concepts/README.md). Reply with its number and any changes you want, or `fallback` to keep the ChatGPT placeholder."

## After Alan's reply

Write the choice into the briefs as a `## Alan's choice` section right after each title
line (replacing any there), then log it and finish `done`:

- **A finalist**: into `build-4.md`, its number, its file, its source file and prompt,
  and his reply verbatim.
- **`fallback`, or "(Alan closed the issue without comment.)"**: into `build-3.md`, "Alan
  chose the fallback at build-2: nothing to do. Log it and finish `done` with no other
  change."; into `build-4.md`, "Alan chose the fallback at build-2: do 'If Alan chose the
  fallback' below, not the rebuild."
- **Anything unclear**: log it and finish `blocked` again with one precise question.

## Acceptance

It passes without the rounds when Alan chose the fallback at build-1.

```bash
grep -q "fallback at build-1" jogging/specs/icon-redraw/build-2.md || { node scripts/recraft.mjs check && test -s docs/icon-concepts/finalists/sheet.png && grep -q "^## Alan's choice" jogging/specs/icon-redraw/build-4.md; }
```
