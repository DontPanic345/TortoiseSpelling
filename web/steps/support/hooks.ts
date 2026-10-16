import { expect } from "@playwright/test";
import { Before } from "./fixtures";
import { home } from "./screens/home";
import { byText } from "./selectors";

// Each test has a fresh browser context, so storage starts empty, as resetApp() wipes the APK's data.
Before(async ({ page }) => {
  await page.goto("./");
  await expect(home.title(page).or(byText(page, "No words yet")).first()).toBeVisible();
});
