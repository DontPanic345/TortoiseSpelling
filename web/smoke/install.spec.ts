import { expect, test } from "../playwright/fixtures";

interface Manifest {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  id: string;
  display: string;
  icons: { src: string; sizes: string; type: string; purpose?: string }[];
}

test("the manifest parses and every icon it names is served", async ({ page, request }) => {
  await page.goto("./");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  const manifestUrl = new URL(href ?? "", page.url()).toString();
  const response = await request.get(manifestUrl);
  expect(response.ok()).toBe(true);
  const manifest = (await response.json()) as Manifest;

  expect(manifest.name).toBe("Tortoise Spelling");
  expect(manifest.display).toBe("standalone");
  expect([manifest.start_url, manifest.scope, manifest.id]).toEqual(["./", "./", "./"]);
  expect(manifest.icons.some((icon) => icon.purpose === "maskable")).toBe(true);

  for (const icon of manifest.icons) {
    const served = await request.get(new URL(icon.src, manifestUrl).toString());
    expect(served.status(), icon.src).toBe(200);
    expect(served.headers()["content-type"], icon.src).toContain(icon.type);
  }
});

test("the apple-touch-icon link resolves", async ({ page, request }) => {
  await page.goto("./");
  const href = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  const served = await request.get(new URL(href ?? "", page.url()).toString());
  expect(served.status()).toBe(200);
  expect(served.headers()["content-type"]).toContain("image/png");
});

test("the browser finds nothing wrong with installing it", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Installability errors come from the Chrome DevTools Protocol");
  await page.goto("./");
  await page.evaluate(() => navigator.serviceWorker.ready);
  const session = await page.context().newCDPSession(page);
  const { installabilityErrors } = (await session.send("Page.getInstallabilityErrors")) as {
    installabilityErrors: unknown[];
  };
  expect(installabilityErrors).toEqual([]);
});
