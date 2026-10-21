# icon-redraw/build-3: The icon generator reads one SVG source

**If an "Alan's choice" section here says he chose the fallback, do only what it says.**

Today `scripts/icon.mjs` draws the icon from geometric primitives in code. The new icon
(build-4) will be hand-cleaned paths, so this step makes the generator read a plain SVG
source, `scripts/icon-source.svg`, and moves today's art into it unchanged in shape. The
outputs and the guarantees stay; only the source changes. No new dependency.

## The source: `scripts/icon-source.svg`

A plain SVG that renders in any browser:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">
  <rect id="background" width="108" height="108" fill="#2F5D50" />
  <path id="shell" fill="#E7BE8A" d="M…Z" />
  <path id="head" fill="#F7F4EE" fill-rule="evenodd" d="M…Z M…Z" />
  <path id="ground-1" fill="#F7F4EE" data-only="launcher" d="M…Z" />
</svg>
```

- Only these elements: the `svg`, one `rect id="background"` (its `fill` is the launcher
  background colour), `path`s, and comments. Anything else is an error naming it.
- A path has a unique `id`, a `fill` of `#RRGGBB`, optionally `fill-rule="evenodd"`, and
  optionally `data-only="launcher"` or `data-only="notification"`.
- Path data uses `M L H V C Q Z`, upper or lower case (relative commands relative to the
  current point, implicit repeats allowed). Any other command, arcs included, is an error
  saying which command and which path.
- Every gap is an absence of paint, never paint in another colour on top, so the same
  paths make the colour, themed and notification icons.

**Interim art.** Write today's shapes into the source as polygons from each part's
`points` in today's `scripts/icon.mjs` (a throwaway conversion you don't commit): the six
shell plates in `#E7BE8A`, the neck, legs and tail in `#F7F4EE`, the head with the eye as
a second subpath and `fill-rule="evenodd"`, and the three ground blanks with
`data-only="launcher"` in solid `#F7F4EE` (opacity isn't supported). Today's tests only
check gaps around the shell, so some body parts break the stricter rules below: the neck
overlaps the head, the tail is 3 units from a leg, and the eye's wall is under 3 units.
Nudge, shrink or drop such parts until the tests pass. The interim art never ships:
build-4 replaces it before the piece's release.

## `scripts/icon.mjs`

Rewrite it (keep its header comment's role, updated: edit `scripts/icon-source.svg` and
re-run). Exports:

```js
export const CANVAS = 108;
export const CENTRE = 54;
export const SAFE_RADIUS = 33;
export const GAP = 3.4; // keep it so that GAP × notification scale ≥ 1
export const SOURCE = "scripts/icon-source.svg";
export const flatten = (d) => [[x, y], …][]; // one point list per subpath; each C/Q sampled at 16 points
export const readSource = (text) => ({ background, parts }); // part: { id, fill, evenOdd, only, d, contours }
export const notificationTransform = () => ({ scale, translateX, translateY });
export const outputs = () => [{ path, text }, …];
```

`only` is `"launcher"`, `"notification"` or `null`. The launcher set is every part but
notification-only; the notification set every part but launcher-only. `node scripts/icon.mjs`
writes every output (as `main` does today, through `writeRepoFile`):

| Output | What |
|---|---|
| `app/src/main/res/drawable/ic_launcher_foreground.xml` | The launcher set, each in its `fill`, on a 108 viewport |
| `app/src/main/res/drawable/ic_launcher_monochrome.xml` | The launcher set, all `#FFFFFFFF` |
| `app/src/main/res/drawable/ic_notification.xml` | The notification set, `#FFFFFFFF`, in a `<group>` scaled and translated so its bounds are centred in the middle 20×20 of a 24 viewport (as today) |
| `app/src/main/res/values/ic_launcher_background.xml` | The `rect`'s fill as `ic_launcher_background` |
| `docs/icon.svg` | The source minus notification-only parts, comments and `data-*` attributes |

Keep today's vector XML format (`vector()`, `androidPath()`): `d` passes through to
`android:pathData` unchanged, `fill-rule="evenodd"` becomes `android:fillType="evenOdd"`.

## `scripts/icon.test.mjs`

| Test | |
|---|---|
| The committed files match the generator | Kept |
| Every launcher contour point is inside the safe circle (≤ `SAFE_RADIUS` from `CENTRE`) | Kept |
| The launcher art's larger dimension is ≥ 52 | Kept, loosened from width only |
| Every notification point maps inside 2..22 | Kept |
| `GAP × notificationTransform().scale ≥ 1` | Kept |
| No two contours of the launcher set, nor of the notification set, are closer than `GAP − 0.05` | Replaces the plate-gap test; also keeps a hole's wall from being a hairline. Reuse today's `distanceBetween` over contours |
| The themed and notification icons are single-colour `#FFFFFFFF` | Kept |
| No launcher part is filled with the background colour, and no contour's first point lies inside another contour unless both are subpaths of one evenodd path | Replaces "the eye is a hole" |
| `readSource` throws, naming them, on an `A` command and on an unknown element (a `<circle>`) | New |
| `flatten` gives a square's four corners (absolute and relative), and a cubic's end points | New |

`web/scripts/icons.mjs` and `web/test/build/icons.test.ts` stay as they are. Run
`cd web && npm run icons` after regenerating, and commit the PNGs and `web/public/icons/icon.svg`.

## Docs

`CLAUDE.md`, "Generated files": the launcher, themed and notification icons and
`docs/icon.svg` come from `scripts/icon-source.svg` through `scripts/icon.mjs`; edit the
source, run `node scripts/icon.mjs` then `npm run icons` in `web/` (`icon.test.mjs` catches
drift). No changelog line: nothing users see changes yet.

## Checks

`node --test 'scripts/*.test.mjs'`, `cd web && npm test`, `./gradlew lintDebug`, and
`./gradlew validateDebugScreenshotTest` (no screenshot should show the icon; if one does,
update it and look). CI runs them all.
