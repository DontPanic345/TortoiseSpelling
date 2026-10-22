# Icon concepts

The record of how the app icon was designed (the `icon-redraw` piece,
[`jogging/specs/icon-redraw.md`](../../jogging/specs/icon-redraw.md)). The images were made
with [Recraft](https://www.recraft.ai/) by `scripts/recraft.mjs`, which keeps every request
and the units it cost in [`log.json`](log.json). Nothing in either app uses this folder.

Each round is a folder of Recraft's SVGs. `dropped.json` lists the ones left off the
round's `sheet.png`, which `cd web && node scripts/icon-sheet.mjs <round>` renders: each
design at 432 px and 48 px in a circle on Evergreen, and at 24 px as a white silhouette,
beside the ChatGPT placeholder from before 0.4.0.

## explore

The first round: six directions, four images each, on `recraftv4_1_vector`. Every request
also passed its palette as Recraft's `controls.colors`. Dropped: `a-01` (a hairline hex
grid and floating legs), `a-02` (broken legs), `c-01` and `c-04` (small art inside a
hairline ring).

| | Direction | Prompt |
|---|---|---|
| a | Flat geometric, side view | App icon: a single tortoise seen from the side, built from a few bold flat geometric shapes (a domed shell split into a few large plates, simple round head, stubby legs). Single app icon, centred, on a plain flat background, a small number of flat shapes, no gradients, no shading, no text, no thin outlines. Palette: evergreen #2F5D50 background, shell amber #E7BE8A, parchment #F7F4EE body. (`a-01` had a hexagon-patterned shell.) |
| b | Friendly cartoon, smiling | App icon: a friendly, cheerful cartoon tortoise in three-quarter view with a big round head, a gentle smile and a dot eye, chunky rounded shapes, a high domed shell with three or four big soft plates. Single app icon, centred, on a plain flat background, a small number of flat shapes, no gradients, no shading, no text, no thin outlines. Palette: evergreen #2F5D50 background, shell amber #E7BE8A, parchment #F7F4EE skin. |
| c | Bold emblem in a badge ring | App icon: a bold emblem — a tortoise in strong heavy silhouette, walking, framed by a thick circular badge ring, chunky shapes with wide gaps between them like a stencil or stamp. Single app icon, centred, on a plain flat background, a small number of flat shapes, no gradients, no shading, no text, no thin outlines. Palette: evergreen #2F5D50 background, shell amber #E7BE8A, parchment #F7F4EE. |
| d | Shell as a word-game letter tile | App icon: a tortoise whose shell is a square letter tile (like a word-game tile) with a single bold capital letter A on it, simple head and legs poking out from under the tile, side view. Flat shapes, no gradients, no other text, centred on a plain background. Palette: evergreen #2F5D50 background, tile amber #E7BE8A, parchment #F7F4EE head and legs, letter in evergreen. |
| e | Top-down, symmetrical mark | App icon: a tortoise seen from directly above, symmetrical, round shell made of a few large flat plates, head and four legs poking out, minimal geometric mark. Single app icon, centred, on a plain flat background, a small number of flat shapes, no gradients, no shading, no text, no thin outlines. Palette: evergreen #2F5D50 background, shell amber #E7BE8A, parchment #F7F4EE head and legs. |
| f | Carrying a pencil, navy and marigold | App icon: a small tortoise carrying a big yellow pencil on its back like a backpack, side view, simple bold flat shapes, playful. Single app icon, centred, on a plain flat background, a small number of flat shapes, no gradients, no shading, no text, no thin outlines. Palette: deep navy #1F3A5F background, marigold #F2B134, cream #FFF8E7. (The sheet shows it on Evergreen: its navy background is the full-canvas shape the sheet drops.) |

## refine-1

Alan picked direction b, from `explore/b-02` and `explore/b-04`. Twelve images on
`recraftv4_1_vector` with the same `controls.colors`; `a` follows `b-02`'s side view and
`b` follows `b-04`'s three-quarter view.

| | Prompt |
|---|---|
| a | App icon: a friendly, cheerful cartoon tortoise walking to the right in side view, its big round parchment head raised on a short thick neck, a gentle smile and one dot eye, four chunky rounded stubby legs. A high domed amber shell made of only three big soft rounded plates, separated by wide bold gaps, with a thick amber rim band along the bottom edge of the shell. The tortoise fills most of the frame. Single app icon, centred, on a plain flat evergreen background, very few flat shapes, wide gaps between parts, no gradients, no shading, no text, no outlines, no small details. Palette: evergreen #2F5D50 background, shell amber #E7BE8A, parchment #F7F4EE skin. |
| b | App icon: a friendly, cheerful cartoon tortoise in three-quarter view facing right, a very big round parchment head tilted slightly up with a wide gentle smile and one dot eye, a chunky body with four short rounded legs. A high domed amber shell with three big soft plates on top and one thick amber rim band around its lower edge, each part separated by a bold even gap. The tortoise fills most of the frame. Single app icon, centred, on a plain flat evergreen background, very few flat shapes, wide gaps between parts, no gradients, no shading, no text, no outlines, no small details. Palette: evergreen #2F5D50 background, shell amber #E7BE8A, parchment #F7F4EE skin. |

What it showed: "fills most of the frame" pushed `a-01`–`a-03`, `b-05` and `b-06` into the
mask, cropping legs and heads; the shells kept four or five plates; and the small belly
slivers between the legs blur into the legs at 24 px.

## refine-2

The round-1 prompts tightened: exactly three plates, one body with no slivers, a clear
margin on every side. `a` again follows the side view, `b` the three-quarter view.

| | Prompt |
|---|---|
| a | App icon: a friendly, cheerful cartoon tortoise walking to the right in side view, a big round parchment head raised on a short thick neck with a gentle smile and one dot eye, four chunky rounded legs, no other pieces. A high domed amber shell with exactly three big soft plates and one thick amber rim band along its lower edge, every part separated by a wide bold even gap. The whole tortoise sits well inside the frame with a clear margin on every side, nothing touching or cut by the edge. Single app icon, centred, on a plain flat evergreen background, very few big flat shapes, no small slivers, no gradients, no shading, no text, no outlines. Palette: evergreen #2F5D50 background, shell amber #E7BE8A, parchment #F7F4EE skin. |
| b | App icon: a friendly, cheerful cartoon tortoise in three-quarter view facing right, a big round parchment head with a wide gentle smile and one dot eye, one chunky parchment body with four short rounded legs and no other pieces. A high domed amber shell with exactly three big soft plates and one thick amber rim band along its lower edge, every part separated by a wide bold even gap. The whole tortoise sits well inside the frame with a clear margin on every side, nothing touching or cut by the edge. Single app icon, centred, on a plain flat evergreen background, very few big flat shapes, no small slivers, no gradients, no shading, no text, no outlines. Palette: evergreen #2F5D50 background, shell amber #E7BE8A, parchment #F7F4EE skin. |

Every image sat inside the safe circle; Recraft still drew four or five plates in most.

## finalists

Five, on [`finalists/sheet.png`](finalists/sheet.png). Whichever Alan picks is rebuilt by
hand as clean paths (build-4), so plate count and the slivers between the legs can change
then.

| | Source | In a phrase |
|---|---|---|
| 1 | `refine-2/b-04.svg` | Three-quarter, big smiling head, the fewest shell plates |
| 2 | `refine-2/b-02.svg` | Three-quarter, big head with a wide grin, taller shell |
| 3 | `refine-1/b-04.svg` | Closest to `explore/b-04`: biggest head, compact body |
| 4 | `refine-2/a-05.svg` | Side view, small head on a neck, calm smile |
| 5 | `refine-2/a-01.svg` | Side view, walking stride, high domed shell |
