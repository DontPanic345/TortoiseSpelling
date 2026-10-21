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
