# icon-redraw/build-1: Recraft client, sheets, the explore round; Alan picks a direction

The app icon is being redesigned with [Recraft](https://www.recraft.ai/). This step writes
the tools, generates a broad first round of distinct styles, builds a contact sheet, and
ends `blocked` so Alan can pick a direction. When his reply comes back to this step, it
writes his choice into the next briefs and finishes `done`.

**First, check whether Alan has replied.** If your prompt holds "Alan's reply to this
piece's blocker", skip to "After Alan's reply". Otherwise build and explore.

Recraft is a paid service, allowed for this piece only, up to 10,000 API units (about
US$10), which is a hard cap. Nothing in either app calls it, and no test or CI job makes a
request. The token is in `RECRAFT_API_TOKEN`: never print it, request headers or the
environment, and never write them to a file.

## 1. `scripts/recraft.mjs`

Read Recraft's current API docs first (https://www.recraft.ai/docs, the API reference:
image generation, styles, "Get user information", pricing). Then check the token and the
balance with one "Get user information" call. If the token is refused or the balance is
under 1,000 units, log it, push, and finish `blocked` with what Alan must fix.

Prices on 21/10/2026: $1 = 1,000 units; a vector image is 80 units on V3, V4 and V4.1 (50
on "V4 Styles"); style references add 5 per request. Use a vector output (for example V3's
`vector_illustration` or `icon` styles, or a V4 vector model) and set the price constant
from the docs as you find them.

Node 22, no dependencies (global `fetch`), an ES module like the other `scripts/*.mjs`
(4-space indent; `REPO_ROOT` from `scripts/repo-files.mjs`):

- Token from `RECRAFT_API_TOKEN`; `generate` exits with a message if it's unset.
  `spent` and `check` only read the ledger and need no token (the crew runs `check`).
- `CAP = 10000`. The ledger is `docs/icon-concepts/log.json`:
  `{ "cap": 10000, "requests": [{ "at", "round", "direction", "model", "style", "prompt", "n", "units", "files": [...] }] }`.
  Spent is the sum of `units`.
- Before a request: estimate `n × price`; refuse with a message and a non-zero exit when
  spent + estimate > `CAP`, or > the balance the API reports.
- After it: record the units actually charged (balance before minus after; the estimate
  if no balance is reported), save each SVG as `docs/icon-concepts/<round>/<direction>-<nn>.svg`
  (`nn` two digits, continuing after any existing files), and append the request to the
  ledger in the same run.
- CLI:
  - `node scripts/recraft.mjs generate --round explore --direction a --n 4 --prompt "…" [--style …] [--model …]`
  - `node scripts/recraft.mjs spent`: prints spent and cap.
  - `node scripts/recraft.mjs check`: exits 0 when spent ≤ cap and every file in the
    ledger exists, else non-zero with what's wrong.
- Keep the pure parts (ledger total, the refusal rule, next file names) as exported
  functions, and run `main` only when executed directly, as `scripts/icon.mjs` does.

`scripts/recraft.test.mjs` (`node:test`, no network): the ledger total; a request that
would pass the cap is refused and one that fits is allowed; a request over the reported
balance is refused; file names continue after existing ones.

## 2. `web/scripts/icon-sheet.mjs`

Beside `web/scripts/icons.mjs` and like it, using `chromium` from `@playwright/test`. Run
as `cd web && node scripts/icon-sheet.mjs <round>` (run `npm ci` and
`npx playwright install chromium` in `web/` first if they're missing), where the round is
a folder of `docs/icon-concepts/` (`explore` now; build-2 uses `refine-1`, `refine-2` and
`finalists`; build-4 adds a `final` round). It builds an HTML page and screenshots it to
`docs/icon-concepts/<round>/sheet.png`. A round's designs are the SVGs in its folder, minus
any listed in `docs/icon-concepts/<round>/dropped.json` (an array of file names).

Each design gets a cell labelled with its file name (and, for explore, its direction
letter in large type), holding:

- 432 px (108 dp at xxxhdpi) on Evergreen `#2F5D50` inside a circle mask,
- 48 px inside a circle mask,
- 24 px as a white silhouette (CSS `filter: brightness(0) invert(1)`) on `#202124`.

Drop a full-canvas background shape from a Recraft SVG (a first path or rect covering the
whole viewBox) before the masks and the silhouette. Put the placeholder in one corner of
the sheet for scale, rendered the same way from
`git show 39188cc^:app/src/main/res/drawable-xxxhdpi/ic_launcher_foreground.webp` and
`git show 39188cc^:app/src/main/res/drawable-xxxhdpi/ic_notification.webp` (full history is
checked out). Don't commit the per-size renders; commit the SVGs, the ledger and the sheet.

## 3. The explore round

About six distinct directions, lettered `a` to `f`, three or four images each (about 24
images, under 2,500 units). Range from flat geometric to friendlier illustrated to bolder
emblem styles, and at least one that ties in spelling (a letter, a tile, a pencil, …).
Every prompt asks for a single tortoise-led icon, centred, on a plain background, with a
small number of flat shapes, no gradients, no text beyond a letter, and the app's palette:
Evergreen `#2F5D50`, shell amber `#E7BE8A`, Parchment `#F7F4EE` (one direction may try
another palette). A different take on the tortoise from the placeholder is welcome.

Look at the sheet. Drop weak images (list them in `explore/dropped.json`) and re-roll a
direction if it has nothing worth showing, within the cap. Judge against:

| Criterion | Pass looks like |
|---|---|
| Quality | At least as polished as the placeholder side by side, at every size. |
| Reads at 48 dp | Recognisable at launcher size on a phone home screen. |
| Silhouette at 24 dp | Still reads as one white shape in the status bar; internal gaps don't fill in. |
| Safe zone | The art fills most of the 66 dp safe circle and no mask crops anything important. |
| Monochrome | Its key details survive when every part is one colour. |
| Fits the app | Sits with the app's palette or proposes a better one. |
| Buildable | Can be rebuilt as a modest number of clean paths. No gradients, textures or hairlines. |

Write `docs/icon-concepts/README.md`: what the folder is (the record of the icon's
design, made with Recraft, nothing in either app uses it), and for the explore round a
line per direction: letter, one-phrase description, prompt.

Commit and push, log, then finish `blocked` with:

"Pick a direction: https://github.com/DontPanic345/TortoiseSpelling/blob/main/docs/icon-concepts/explore/sheet.png (directions in docs/icon-concepts/README.md). Reply with a letter or two, describe another direction, or reply `fallback` to keep the ChatGPT placeholder."

## After Alan's reply

Write the choice into the briefs as a `## Alan's choice` section right after each title
line, then log it and finish `done`:

- **A direction** (one or two letters, or a described direction): into `build-2.md`, the
  letters, their prompts and file names (or his description), and his reply verbatim.
- **`fallback`, or "(Alan closed the issue without comment.)"**: into `build-2.md` and
  `build-3.md`, "Alan chose the fallback at build-1: nothing to do. Log it and finish
  `done` with no other change."; into `build-4.md`, "Alan chose the fallback at build-1:
  do 'If Alan chose the fallback' below, not the rebuild."
- **Anything unclear**: log it and finish `blocked` again with one precise question.

## Acceptance

```bash
node scripts/recraft.mjs check
test -s docs/icon-concepts/explore/sheet.png
grep -q "^## Alan's choice" jogging/specs/icon-redraw/build-2.md
```
