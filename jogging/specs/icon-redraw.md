# Piece: icon-redraw

A new app icon, designed in house: Claude explores distinct styles with
[Recraft](https://www.recraft.ai/), Alan picks a direction and then a final design at two
checkpoints, and Claude rebuilds the pick as clean vector shapes in one source file that
generates every icon the two apps ship. Source: [`docs/icon-redraw.md`](../../docs/icon-redraw.md),
approved by Alan on 20/10/2026.

## What it delivers

- `scripts/recraft.mjs`: a dependency-free Node client for Recraft's API that keeps a
  running total of units spent and refuses a request that would pass the cap.
- `docs/icon-concepts/`: every prompt and result, a contact sheet of the first round, a
  finalists sheet, and a side-by-side of the final against the ChatGPT placeholder.
- A redesigned generator: `scripts/icon-source.svg` (hand-cleaned paths) is the one source;
  `scripts/icon.mjs` generates the launcher foreground, the themed (monochrome) icon, the
  notification icon, the launcher background colour and `docs/icon.svg`; `npm run icons` in
  `web/` makes the web icons from `docs/icon.svg`.
- The new icon on Android (launcher, themed, notification) and the web (favicon, PWA and
  touch icons), with a `CHANGELOG.md` line.
- Or, if Alan says "fallback" at either checkpoint, the placeholder WebPs restored and the
  generator retired.

Goals and decisions it leans on:

- **Icon design is paid** (decision, 20/10/2026): Recraft units up to the 10,000 bought.
  Recraft is used only while designing; nothing in either app calls it, and no request
  is made from tests or CI.
- **Goal 2.** The notification icon is the reminder's face in the status bar: it must
  stay a single white silhouette that reads at 24 dp. The reminder's behaviour is
  untouched.
- **Goal 5.** Android and the web show the same icon, both generated from one source.
- **Goal 7.** No new dependency: Node's `fetch`, and the Playwright Chromium `web/`
  already installs.

## Design

### The checkpoints

build-1 and build-2 each end `blocked` on purpose. The crew opens an issue with the
blocker text; Alan's reply (or his closing the issue) sets the step back to `pending`, and
the next session of the *same step* gets the reply. That session writes the choice into
the following briefs under a `## Alan's choice` heading placed right after the title, logs
it, and finishes `done`. A step can't change statuses, so a choice that makes a later step
moot is written into that step's brief as "nothing to do: log and finish `done`".

| Reply | build-1 writes | build-2 writes |
|---|---|---|
| A direction (letter or letters), or a described new direction | build-2: the direction(s), their prompts and files, Alan's words verbatim | n/a |
| A finalist (number), with any notes | n/a | build-4: the finalist's file, prompt, and Alan's words verbatim |
| `fallback`, or the issue closed without comment (the reply reads "(Alan closed the issue without comment.)") | build-2 and build-3: nothing to do; build-4: do the fallback | build-3: nothing to do; build-4: do the fallback |
| Anything unclear | block again with a precise question | block again with a precise question |

### Spending

Prices from Recraft's [pricing page](https://www.recraft.ai/docs/api-reference/pricing)
on 21/10/2026: $1 = 1,000 units; a vector image costs 80 units on V3, V4 and V4.1 (50 on
"V4 Styles"); style references add 5 per request. The plan is about 50 vector images,
around 4,000 units, so the cap leaves room for re-rolls. The balance is read with the
"Get user information" endpoint.

`scripts/recraft.mjs` (Node 22, no dependencies, ES module like the other scripts):

- Token from `RECRAFT_API_TOKEN`. Never printed, logged, or written to a file, and neither
  are request headers or the environment. Exits with a message if it's unset.
- `CAP = 10000`. The ledger is `docs/icon-concepts/log.json`:
  `{ "cap": 10000, "requests": [{ "at", "round", "direction", "model", "style", "prompt", "n", "units", "files": [...] }] }`.
  Spent is the sum of `units`. Before a request it estimates `n × price` (the price per
  image a constant set from the docs) and refuses, with a message and a non-zero exit,
  when spent + estimate passes `CAP` or the reported balance. After a request it records
  the units actually charged: the balance before minus after, or the estimate if the API
  doesn't report a balance.
- Saves each returned SVG as `docs/icon-concepts/<round>/<direction>-<nn>.svg` and
  appends the request to the ledger in the same run.
- CLI: `node scripts/recraft.mjs generate --round explore --direction a --n 4 --prompt "…" [--style …] [--model …]`,
  `node scripts/recraft.mjs spent` (prints spent and cap), and
  `node scripts/recraft.mjs check` (exits 0 when spent ≤ cap and every ledger file exists).
- `scripts/recraft.test.mjs` tests the pure parts (ledger totals, the refusal rule,
  file naming) with no network; CI runs it with the other script tests.
- API details change: build-1 reads Recraft's current API docs before writing it, and
  blocks if the token or the balance doesn't work.

### Rendering and sheets

`web/scripts/icon-sheet.mjs`, beside `icons.mjs` and like it using `@playwright/test`'s
Chromium, run as `cd web && node scripts/icon-sheet.mjs <round>` for the rounds
`explore`, `refine-1`, `refine-2`, `finalists` (copies numbered `1.svg`…`5.svg`) and
`final` (`docs/icon.svg` at 432 and 48 px; at 24 px the notification set from
`scripts/icon-source.svg`, so notification-only parts are what's judged). It lays out an HTML page and screenshots it to
`docs/icon-concepts/<round>/sheet.png` (`final` writes `docs/icon-concepts/final.png`).
A round's designs are the SVGs in its folder minus those listed in its `dropped.json`.
Each design gets a labelled cell with:

- 432 px (108 dp at xxxhdpi) on Evergreen inside a circle mask,
- 48 px inside a circle mask,
- 24 px as a white silhouette (CSS `filter: brightness(0) invert(1)`) on `#202124`.

A full-canvas background shape in a Recraft SVG is dropped before rendering the
silhouette and the masks. The placeholder sits in one corner of every sheet for scale,
rendered the same way from `git show 39188cc^:app/src/main/res/drawable-xxxhdpi/ic_launcher_foreground.webp`
and `.../ic_notification.webp` (the Jogging checkout has full history). The per-size
renders aren't committed; the SVGs, the ledger and the sheets are. Sessions look at the
sheets (the Read tool shows PNGs) to judge.

### How designs are judged

| Criterion | Pass looks like |
|---|---|
| Quality | At least as polished as the placeholder side by side, at every size. |
| Reads at 48 dp | Recognisable at launcher size on a phone home screen. |
| Silhouette at 24 dp | Still reads as one white shape in the status bar; internal gaps don't fill in. |
| Safe zone | The art fills most of the 66 dp safe circle and no mask crops anything important. |
| Monochrome | Its key details survive when every part is one colour. |
| Fits the app | Sits with the app's palette (Evergreen `#2F5D50`, shell amber `#E7BE8A`, Parchment `#F7F4EE`) or proposes a better one. |
| Buildable | Can be rebuilt as a modest number of clean paths. No gradients, textures or hairlines. |

### The generator

The source is `scripts/icon-source.svg`, a plain SVG that renders in any browser:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">
  <rect id="background" width="108" height="108" fill="#2F5D50" />
  <path id="shell" fill="#E7BE8A" d="M…Z" />
  <path id="head" fill="#F7F4EE" fill-rule="evenodd" d="M…Z M…Z" />
  <path id="ground" fill="#F7F4EE" data-only="launcher" d="M…Z" />
</svg>
```

- Only these elements: the `svg`, one `rect id="background"` (its `fill` is the launcher
  background colour), `path`s, and comments. Anything else is an error naming it.
- A path has a unique `id`, a `fill` of `#RRGGBB`, optionally `fill-rule="evenodd"`, and
  optionally `data-only="launcher"` or `data-only="notification"`. Path data uses
  `M L H V C Q Z`, upper or lower case; any other command (arcs included) is an error
  saying which, so the geometry tests can flatten every contour exactly.
- Every gap is an absence of paint, never paint in another colour on top: one colour or
  many, the same paths make the colour, themed and notification icons.

`scripts/icon.mjs` exports `CANVAS = 108`, `CENTRE = 54`, `SAFE_RADIUS = 33`, `GAP`,
`readSource(text)` → `{ background, parts }` with each part
`{ id, fill, evenOdd, only, d, contours }` (`contours`: one point list per subpath, curves
sampled at 16 points each), `flatten(d)`, `notificationTransform()`, and `outputs()`, the
list of `{ path, text }` it writes:

| Output | What |
|---|---|
| `app/src/main/res/drawable/ic_launcher_foreground.xml` | Every part but notification-only, in its `fill`, on a 108 viewport |
| `app/src/main/res/drawable/ic_launcher_monochrome.xml` | The same parts, all `#FFFFFFFF` |
| `app/src/main/res/drawable/ic_notification.xml` | Every part but launcher-only, white, in a `<group>` scaled and centred into the middle 20×20 of a 24 viewport |
| `app/src/main/res/values/ic_launcher_background.xml` | The background `rect`'s colour as `ic_launcher_background` |
| `docs/icon.svg` | The source without `data-only="notification"` parts or `data-*` attributes |

`d` passes through to `android:pathData` unchanged; `fill-rule="evenodd"` becomes
`android:fillType="evenOdd"`. `node scripts/icon.mjs` writes them all.

`scripts/icon.test.mjs`, from today's tests:

| Test | Fate |
|---|---|
| The committed files match the generator | Kept |
| Every launcher point inside the safe circle | Kept, over every launcher contour |
| The art fills most of the safe circle | Kept: the launcher art's larger dimension ≥ 52 |
| The notification art inside its 20×20 box | Kept |
| Gaps a unit wide at 24 dp; plates a gap apart | Replaced: `GAP × notification scale ≥ 1`, and no two contours of the launcher set, nor of the notification set, come closer than `GAP − 0.05` (this also keeps a hole's wall from being a hairline) |
| Themed and notification icons single-colour | Kept |
| The eye is a hole | Replaced: no launcher part is filled with the background colour, and no contour lies inside another part's contour unless both are subpaths of one evenodd path |
| New | `readSource` rejects an arc and an unknown element with messages naming them; `flatten` gives a square's corners and a cubic's end points |

build-3 builds the generator on an interim source: today's shapes as polygons from their
`points` (the ground parts `data-only="launcher"`, solid Parchment), so everything is
green before the art changes. Today's tests only check gaps around the shell, so parts
that break the stricter rules (the neck overlaps the head, the tail is 3 units from a
leg, the eye's wall is under 3) are nudged, shrunk or dropped; the interim art never
ships. build-4 replaces the source with the new art.

`web/scripts/icons.mjs` and its test stay as they are: they read `docs/icon.svg`.

### The fallback

On "fallback", build-4 instead:

- restores the 15 placeholder WebPs and the background colour from `39188cc^`:
  `git checkout 39188cc^ -- app/src/main/res/drawable-mdpi app/src/main/res/drawable-hdpi app/src/main/res/drawable-xhdpi app/src/main/res/drawable-xxhdpi app/src/main/res/drawable-xxxhdpi app/src/main/res/values/ic_launcher_background.xml`;
- deletes the three generated XMLs in `app/src/main/res/drawable/`;
- writes `docs/icon.svg` by hand as a 108 viewBox SVG: the Evergreen `rect` and an
  `<image>` of the xxxhdpi foreground as a `data:image/webp;base64,…` URI, full size;
- runs `npm run icons` in `web/`;
- deletes `scripts/icon.mjs`, `scripts/icon.test.mjs` and `scripts/icon-source.svg` if
  present, and rewrites `CLAUDE.md`'s "Generated files" paragraph to say the Android
  icons are the placeholder WebPs and `docs/icon.svg` wraps the launcher one for the web.

### Steps

| Step | What | Model |
|---|---|---|
| build-1 | `recraft.mjs` and its test, `icon-sheet.mjs`, the explore round (about six directions × three or four images), the contact sheet; blocks "Pick a direction" | Opus medium |
| build-2 | Two refine rounds of about 12 images in the chosen direction, the finalists sheet (three to five); blocks "Pick the final" | Opus medium |
| build-3 | The generator from `scripts/icon-source.svg`, on today's shapes | Sonnet high |
| build-4 | The pick rebuilt as clean paths, every output, web icons, `final.png`, changelog (or the fallback) | Opus high |
| review | The whole piece and the icon on the emulator | Opus medium |

### Docs

- `CLAUDE.md`, "Generated files": the source is `scripts/icon-source.svg`, generated by
  `node scripts/icon.mjs`, then `npm run icons` in `web/` (build-3; rewritten on fallback).
- `CHANGELOG.md` under `[Unreleased]`, "Changed": "A new app icon, with a matching themed
  icon and notification icon." (build-4), or on fallback "The app icon is back to the
  tortoise from before 0.4.0, with its themed and notification icons."
- `PRIVACY.md` and `README.md`: no change; neither app talks to Recraft.

## What later pieces rely on

Nothing in the queue depends on this piece. After it, the icon is edited in
`scripts/icon-source.svg` and regenerated; `docs/icon-concepts/` stays as the record.
