import { expect } from "@playwright/test";
import { Given, Then, When } from "./support/fixtures";
import { home } from "./support/screens/home";
import { byTestId } from "./support/selectors";
import { TestIds } from "../src/ui/testIds";

// The test build's reminder fakes stand in for the browser's prompt (src/debug/seedHook.ts),
// and the Home card is where the web asks, as Android's system dialog is.

/** Every web scenario starts in a fresh browser context, which is as good as a fresh install. */
Given("the app is freshly installed", async () => {});

Then("I am asked to allow notifications", async ({ page }) => {
  await expect(byTestId(page, TestIds.HOME_REMINDER_CARD)).toBeVisible();
});

Then("I am not asked to allow notifications", async ({ page }) => {
  await expect(home.title(page)).toBeVisible();
  await expect(byTestId(page, TestIds.HOME_REMINDER_CARD)).toHaveCount(0);
});

When("I allow notifications", async ({ page }) => {
  await page.evaluate(() => window.__tortoiseSpellingPush?.answer("granted"));
  await byTestId(page, TestIds.HOME_REMINDER_TURN_ON).click();
});
