# icon-redraw/build-4: Rebuild the chosen design as the app icon

The app icon was designed with Recraft in build-1 and build-2, and Alan picked a final;
his choice is under "Alan's choice" below (build-2 writes it there, or build-1 if he chose
the fallback early). Recraft's SVGs are traced pictures: they are the reference to rebuild
from, never the committed art. No Recraft calls in this step.

If there is no "Alan's choice" section, an earlier step didn't finish: finish `blocked`
saying so. If it says he chose the fallback, skip to "If Alan chose the fallback".

## The rebuild

Redraw the pick by hand in `scripts/icon-source.svg`, replacing the interim art build-3
left there, with a modest number of clean paths. Apply any changes Alan asked for. The
source's rules (enforced by `scripts/icon.mjs` and `scripts/icon.test.mjs`):

- Only the `svg`, one `<rect id="background" width="108" height="108" fill="#……"/>` (the
  launcher background colour), `path`s and comments; viewBox `0 0 108 108`.
- Each path: a unique `id`, `fill="#RRGGBB"`, optionally `fill-rule="evenodd"`, optionally
  `data-only="launcher"` (left out of the notification icon) or `data-only="notification"`
  (only in it). Path data `M L H V C Q Z` only (no arcs: write circles as four cubics).
- Every gap is an absence of paint, never paint on top of paint: the same paths make the
  colour, themed (all white) and notification (white, scaled into 20×20 of 24) icons.
- Every launcher point within 33 of the centre (54, 54), the art's larger dimension at
  least 52, no two contours closer than `GAP` (3.4; `GAP` × the notification scale must
  stay ≥ 1, so a smaller notification set needs a larger `GAP` and vice versa), no part in
  the background colour, no contour inside another unless both are subpaths of one
  evenodd path.

If the pick's details don't survive at 24 dp, give the notification its own simplified
parts with `data-only` rather than weakening the launcher art. Palette: the pick's, or
the app's Evergreen `#2F5D50`, shell amber `#E7BE8A`, Parchment `#F7F4EE`. No gradients,
textures or hairlines.

Then:

1. `node scripts/icon.mjs`, and `cd web && npm run icons`; commit every output and the
   web PNGs.
2. Render the side-by-side: add a `final` round to `web/scripts/icon-sheet.mjs` that
   shows `docs/icon.svg` beside the placeholder (which the script already renders from
   `git show 39188cc^:…`) at 108 dp (432 px), 48 and 24 dp, and run
   `cd web && node scripts/icon-sheet.mjs final` to write `docs/icon-concepts/final.png`.
   Look at it against the criteria below; iterate on the paths until it passes.
3. Add the final to `docs/icon-concepts/README.md`.

| Criterion | Pass looks like |
|---|---|
| Quality | At least as polished as the placeholder side by side, at every size. |
| Reads at 48 dp | Recognisable at launcher size on a phone home screen. |
| Silhouette at 24 dp | Still reads as one white shape in the status bar; internal gaps don't fill in. |
| Safe zone | The art fills most of the 66 dp safe circle and no mask crops anything important. |
| Monochrome | Its key details survive when every part is one colour. |
| Buildable | A modest number of clean paths. |

## If Alan chose the fallback

Restore the ChatGPT placeholder and retire the generator:

1. `git checkout 39188cc^ -- app/src/main/res/drawable-mdpi app/src/main/res/drawable-hdpi app/src/main/res/drawable-xhdpi app/src/main/res/drawable-xxhdpi app/src/main/res/drawable-xxxhdpi app/src/main/res/values/ic_launcher_background.xml`
   (15 WebPs: launcher foreground, monochrome and notification at five densities).
2. Delete `app/src/main/res/drawable/ic_launcher_foreground.xml`, `ic_launcher_monochrome.xml`
   and `ic_notification.xml`. The `mipmap-anydpi-v26` XMLs and `R.drawable.ic_notification`
   in `ReminderWorker` stay as they are.
3. Write `docs/icon.svg` by hand: `viewBox="0 0 108 108"`, a full `rect` in the restored
   background colour, and an `<image width="108" height="108" href="data:image/webp;base64,…"/>`
   of `drawable-xxxhdpi/ic_launcher_foreground.webp`. Run `cd web && npm run icons`.
4. Delete `scripts/icon.mjs`, `scripts/icon.test.mjs` and `scripts/icon-source.svg` (if
   present), and rewrite `CLAUDE.md`'s "Generated files" paragraph: the Android icons are
   the placeholder WebPs in `drawable-*dpi`, and `docs/icon.svg` wraps the launcher one;
   `npm run icons` in `web/` makes the web icons from it.

## Both paths

- `CHANGELOG.md` under `[Unreleased]`, `### Changed` (add the heading if missing): "A new
  app icon, with a matching themed icon and notification icon." (On fallback: "The app
  icon is back to the tortoise from before 0.4.0, with its themed and notification
  icons.")
- `./gradlew validateDebugScreenshotTest`: no screenshot should show the icon; if one
  does, `updateDebugScreenshotTest`, look, and commit.
- Checks: `node --test 'scripts/*.test.mjs'`, `cd web && npm test && npm run typecheck`,
  `./gradlew testDebugUnitTest lintDebug`.
- Install the debug build on the emulator and look at the launcher icon once
  (`adb shell screencap`), to catch a resource that doesn't load.

## Acceptance

```bash
./gradlew assembleRelease
test -s docs/icon-concepts/final.png || grep -q "fallback at build" jogging/specs/icon-redraw/build-4.md
```
