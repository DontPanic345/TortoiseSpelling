import { defineConfig } from "@playwright/test";

const baseURL = process.env.SMOKE_URL ?? "http://localhost:4173/";

export default defineConfig({
  testDir: "smoke",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  webServer: process.env.SMOKE_URL
    ? undefined
    : { command: "npm run build && npm run preview", url: baseURL, reuseExistingServer: !process.env.CI },
});
