// Rasterises docs/icon.svg into the web app's PNG icons with Playwright's Chromium, and copies
// the SVG beside them. Run `npm run icons` after the icon changes, and commit the files.
import { copyFile, readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const source = new URL("../../docs/icon.svg", import.meta.url);
const out = new URL("../public/icons/", import.meta.url);
const sizes = { "icon-192.png": 192, "icon-512.png": 512, "apple-touch-icon.png": 180 };

const svg = await readFile(source, "utf8");
const browser = await chromium.launch();
try {
  for (const [name, size] of Object.entries(sizes)) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    );
    await page.screenshot({ path: new URL(name, out).pathname, omitBackground: true });
    await page.close();
  }
} finally {
  await browser.close();
}
await copyFile(source, new URL("icon.svg", out));
