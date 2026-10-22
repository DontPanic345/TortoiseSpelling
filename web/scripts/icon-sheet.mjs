// Renders a round of icon concepts to a contact sheet with Playwright's Chromium:
//
//   node scripts/icon-sheet.mjs <round>     (explore, refine-1, refine-2, finalists, final)
//
// The round is a folder of docs/icon-concepts/; its designs are the SVGs there minus any
// named in its dropped.json. Each gets a cell at 432 px masked on Evergreen, 48 px masked,
// and 24 px as a white silhouette, with the pre-0.4.0 placeholder in the first cell for
// scale. Writes docs/icon-concepts/<round>/sheet.png.
//
// The final round is the shipped icon, docs/icon.svg, whose 24 px silhouette is the
// notification set of scripts/icon-source.svg. Writes docs/icon-concepts/final.png.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const round = process.argv[2];
if (!round || !/^[a-z0-9-]+$/.test(round)) {
  console.error("usage: node scripts/icon-sheet.mjs <round>");
  process.exit(1);
}
const repo = new URL("../../", import.meta.url);
const final = round === "final";
const folder = new URL(final ? "docs/icon-concepts/" : `docs/icon-concepts/${round}/`, repo);
if (!existsSync(folder)) {
  console.error(`no such round: docs/icon-concepts/${round}`);
  process.exit(1);
}

const roundDesigns = async () => {
  const dropped = existsSync(new URL("dropped.json", folder))
    ? JSON.parse(await readFile(new URL("dropped.json", folder), "utf8"))
    : [];
  const names = (await readdir(folder)).filter((f) => f.endsWith(".svg") && !dropped.includes(f)).sort();
  return Promise.all(names.map(async (name) => ({ name, svg: await readFile(new URL(name, folder), "utf8") })));
};

// The status bar shows the notification set: the source without its launcher-only parts.
const finalDesign = async () => {
  const source = await readFile(new URL("scripts/icon-source.svg", repo), "utf8");
  return [
    {
      name: "final (docs/icon.svg)",
      svg: await readFile(new URL("docs/icon.svg", repo), "utf8"),
      silhouette: source.replace(/[ \t]*<path\b[^>]*\sdata-only="launcher"[^>]*>[ \t]*\n?/g, ""),
    },
  ];
};

const designs = final ? await finalDesign() : await roundDesigns();
const output = new URL(final ? "final.png" : "sheet.png", folder);

// The placeholder the redraw replaces, from before the generator took over (39188cc).
const placeholder = (file) =>
  "data:image/webp;base64," +
  execFileSync("git", ["show", `39188cc^:app/src/main/res/drawable-xxxhdpi/${file}`], {
    cwd: repo.pathname,
  }).toString("base64");

const EVERGREEN = "#2F5D50";
const page = `<!doctype html><style>
  body { margin: 0; padding: 24px; background: #FFFFFF; font: 16px system-ui, sans-serif; color: #202124; }
  h1 { margin: 0 0 16px; font-size: 28px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, 456px); gap: 20px; }
  .cell { border: 1px solid #DADCE0; border-radius: 12px; padding: 12px; }
  .label { display: flex; align-items: baseline; gap: 12px; height: 48px; margin-bottom: 8px; }
  .letter { font-size: 40px; font-weight: 700; }
  .big { width: 432px; height: 432px; border-radius: 50%; overflow: hidden; background: ${EVERGREEN}; }
  .row { display: flex; align-items: center; gap: 16px; margin-top: 12px; }
  .small { width: 48px; height: 48px; border-radius: 50%; overflow: hidden; background: ${EVERGREEN}; }
  .status { padding: 8px 12px; background: #202124; border-radius: 8px; display: flex; gap: 8px; align-items: center; }
  .status img { width: 24px; height: 24px; filter: brightness(0) invert(1); }
  .status span { color: #FFFFFF; font-size: 14px; }
  img { display: block; width: 100%; height: 100%; }
</style><h1>docs/icon-concepts/${round}</h1><div class="grid" id="grid"></div>`;

const browser = await chromium.launch();
try {
  const columns = Math.min(5, designs.length + 1);
  const tab = await browser.newPage({ viewport: { width: columns * 456 + (columns - 1) * 20 + 48, height: 800 } });
  await tab.setContent(page);
  await tab.evaluate(
    ({ designs, round, launcher, notification }) => {
      // Recraft draws the background as a first path or rect over the whole canvas; drop
      // it so only the art sits on the masks and the silhouette.
      // frame: fit the art into the middle 20 of 24, as the notification icon is drawn.
      const withoutBackground = (text, frame = false) => {
        const svg = new DOMParser().parseFromString(text, "image/svg+xml").documentElement;
        svg.querySelector("metadata")?.remove();
        const host = document.createElement("div");
        host.style.cssText = "position:absolute;visibility:hidden";
        host.appendChild(svg);
        document.body.appendChild(host);
        const view = svg.viewBox.baseVal;
        const first = svg.querySelector("path, rect");
        if (first) {
          const box = first.getBBox();
          if (box.width >= view.width * 0.99 && box.height >= view.height * 0.99) {
            first.remove();
          }
        }
        if (frame) {
          const art = svg.getBBox();
          const side = (Math.max(art.width, art.height) * 24) / 20;
          svg.setAttribute("viewBox", `${art.x + art.width / 2 - side / 2} ${art.y + art.height / 2 - side / 2} ${side} ${side}`);
        }
        host.remove();
        return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg.outerHTML)));
      };
      const cell = (name, letter, art, silhouette) => {
        const div = document.createElement("div");
        div.className = "cell";
        div.innerHTML =
          `<div class="label">${letter ? `<span class="letter">${letter}</span>` : ""}<span>${name}</span></div>` +
          `<div class="big"><img src="${art}"></div>` +
          `<div class="row"><div class="small"><img src="${art}"></div>` +
          `<div class="status"><img src="${silhouette}"><span>9:41 · Time to practise</span></div></div>`;
        document.getElementById("grid").appendChild(div);
      };
      cell("placeholder (before 0.4.0)", "", launcher, notification);
      for (const { name, svg, silhouette } of designs) {
        const art = withoutBackground(svg);
        const status = silhouette ? withoutBackground(silhouette, true) : art;
        cell(name, round === "explore" ? name.split("-")[0].toUpperCase() : "", art, status);
      }
    },
    {
      designs,
      round,
      launcher: placeholder("ic_launcher_foreground.webp"),
      notification: placeholder("ic_notification.webp"),
    },
  );
  await tab.waitForFunction(() => [...document.images].every((i) => i.complete));
  await tab.screenshot({ path: output.pathname, fullPage: true });
} finally {
  await browser.close();
}
