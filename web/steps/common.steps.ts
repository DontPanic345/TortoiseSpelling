import { expect } from "@playwright/test";
import { Then, When } from "./support/fixtures";
import { byText, choice } from "./support/selectors";

// Steps about what is on screen, shared by every feature, as in e2e/step-definitions/common.steps.ts.

/** For transient messages: snackbars and inline confirmations. */
Then("I am told {string}", async ({ page }, message: string) => {
  await expect(byText(page, message)).toBeVisible();
});

Then("I see {string}", async ({ page }, text: string) => {
  await expect(byText(page, text)).toBeVisible();
});

/** Clicks any button, menu item or link found by its accessible name. */
When("I choose {string}", async ({ page }, label: string) => {
  await choice(page, label).click();
});
