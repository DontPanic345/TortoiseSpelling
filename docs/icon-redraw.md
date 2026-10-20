# Icon redraw

Design the app icon in house, through a process Alan controls. Claude explores several
distinct styles with [Recraft](https://www.recraft.ai/), Alan chooses a direction and then
a final design, and Claude rebuilds it as clean vector shapes in the repo. Approved by Alan
on 20/10/2026; this is the design doc for the Jogging piece `icon-redraw`.

## Where the icon is now

- **The ChatGPT placeholder** (added 18/09 in `d538866` as PNGs, converted to WebP in
  `ac47111`, removed in `39188cc`). 15 files with every variant Android needs: launcher
  foreground, monochrome and notification at five densities. It is the quality bar and
  the fallback, not the target look.
- **The current icon** on main, drawn by `scripts/icon.mjs`. It didn't reach a good
  result, so neither its art nor its generator has to be kept.
- **The parked vector copy** on branch `icon-vector-tortoise` (`69e54f1`) is a trace of
  the placeholder. Don't build on it.

A new design passes if, side by side with the placeholder at 108, 48 and 24 dp, it looks
at least as good. It doesn't have to look like it: a different take on the tortoise is
welcome, and so is a style the placeholder never tried.

## Decisions

- **Two checkpoints, both Alan's.** After a broad first round Alan sees a contact sheet
  of distinct styles and chooses one or two directions, or names another. After refining
  Alan chooses one of three to five finalists. Each checkpoint is a step that ends
  `blocked` on purpose; Alan's reply comes back to the same step, which writes the choice
  into the next step's brief and finishes.
- **Fallback.** A reply of "fallback" at either checkpoint, or closing the issue without
  a comment, restores the 15 placeholder files from `39188cc^`, makes the web icons from
  them, and retires the generator.
- **Paid service.** Recraft is an exception to goal 6 for this piece only (recorded in
  `jogging/GOALS.md`). It is used only while designing; nothing in either app calls it.
  Alan's balance is 10,000 API units (about US$10), which is the hard cap. The plan needs
  about 50 vector images; check the current unit price per image in Recraft's API docs.
- **The generator may change.** The spec may redesign `scripts/icon.mjs`: for example a
  hand-cleaned SVG as the source instead of geometric primitives, or separate art for the
  notification icon. What stays fixed is the result: one source in the repo that
  generates the launcher foreground, the themed (monochrome) icon, the notification icon,
  `docs/icon.svg` and the web icons, with a test that fails if the committed files drift
  from it. Recraft's SVGs are traced pictures, so they are a reference to rebuild from,
  never the committed art.
- **Release.** The piece changes the Android app for users: `"release": "minor"`.

## Steps

The spec sets the final briefs, models and checks.

1. **spec**, **spec-review**: as usual. The spec decides how the generator works for the
   new art and which of today's icon tests survive.
2. **Explore.** Write `scripts/recraft.mjs`: Node, no dependencies, the token from
   `RECRAFT_API_TOKEN`, a running total of units spent that stops before the cap, and
   every prompt and result saved under `docs/icon-concepts/`. Render each result with
   Playwright's Chromium at 432, 48 and 24 px, as a white silhouette and inside a circle
   mask. Generate about six distinct directions, three or four images each, ranging from
   flat geometric to friendlier illustrated to bolder emblem styles, with at least one
   that ties in spelling. Drop weak images and build a contact sheet with the placeholder
   in one corner for scale. Ends blocked: "Pick a direction."
3. **Refine.** Two rounds within the chosen direction, about 12 images each, tightening
   the prompt between rounds against the criteria below. A finalists sheet of three to
   five, each beside the placeholder at all three sizes. Ends blocked: "Pick the final."
4. **Build.** Rebuild the pick as clean shapes in the icon source. Generate every output,
   run `npm run icons` in `web/`, update tests and screenshot references, add a
   `CHANGELOG.md` line, and commit a side-by-side of the final against the placeholder.
5. **Review.** The whole piece, plus the icon on the emulator: launcher masks, the themed
   icon on light and dark wallpaper, and a real reminder notification in the status bar.

## How designs are judged

| Criterion | Pass looks like |
|---|---|
| Quality | At least as polished as the placeholder side by side, at every size. |
| Reads at 48 dp | Recognisable at launcher size on a phone home screen. |
| Silhouette at 24 dp | Still reads as one white shape in the status bar; internal gaps don't fill in. |
| Safe zone | The art fills most of the 66 dp safe circle and no mask crops anything important. |
| Monochrome | Its key details survive when every part is one colour. |
| Fits the app | Sits with the app's palette (Evergreen `#2F5D50`, shell amber, Parchment `#F7F4EE`) or proposes a better one. |
| Buildable | Can be rebuilt as a modest number of clean paths. No gradients, textures or hairlines. |

## Context

- **Web icons.** `web/scripts/icons.mjs` (`npm run icons`) rasterises `docs/icon.svg`
  into `web/public/icons/`.
- **Android constraints worth keeping as tests:** art inside the 66 dp safe circle,
  notification art inside its 20×20 box, single-colour themed and notification icons, and
  gaps at least one unit wide at 24 dp.
- **Rendering in CI.** Playwright's Chromium is installed for `web/`, and the Jogging
  checkout has full history, so `git show` reaches the placeholder.
- **The token.** `jogging.yml` passes `RECRAFT_API_TOKEN` to sessions and the crew
  redacts it from transcripts. Never print it, request headers or the environment.
- **API details change.** Read Recraft's current API docs before writing the script, and
  block if the token or the balance doesn't work.
