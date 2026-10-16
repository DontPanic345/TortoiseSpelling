import { defineConfig, devices } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";

const baseURL = "http://localhost:4174/";
const viewport = { width: 412, height: 915 };

// The shared specs in ../specs, minus what only Android can run, against the `--mode e2e`
// build (production plus the seed hook). Desktop devices at a phone's width: touch emulation
// would send export down the share-sheet path, which Playwright can't complete.
const testDir = defineBddConfig({
  featuresRoot: "../specs",
  features: "../specs/*.feature",
  steps: "steps/**/*.ts",
  tags: "@e2e and not @android and not @todo",
});

export default defineConfig({
  testDir,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    {
      name: "specs-chromium",
      use: { ...devices["Desktop Chrome"], viewport, permissions: ["clipboard-read", "clipboard-write"] },
    },
    { name: "specs-webkit", use: { ...devices["Desktop Safari"], viewport } },
  ],
  webServer: {
    command: "npm run build:e2e && npm run preview:e2e",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
