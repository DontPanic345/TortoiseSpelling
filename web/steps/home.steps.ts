import { expect } from "@playwright/test";
import { Then, When } from "./support/fixtures";
import { home } from "./support/screens/home";
import { byLabelIn, byText } from "./support/selectors";
import { TestIds } from "../src/ui/testIds";

When("I go back to Home", async ({ page }) => {
  await home.goBack(page);
});

Then("I am on Home", async ({ page }) => {
  await expect(home.title(page)).toBeVisible();
});

Then("Home shows {int} word(s) to practise today", async ({ page }, count: number) => {
  await expect(home.practiceCount(page)).toHaveText(String(count));
  const caption = count === 1 ? "word to practise today" : "words to practise today";
  await expect(byText(page, caption)).toBeVisible();
});

Then("{int} of them is/are new", async ({ page }, count: number) => {
  const caption = count === 1 ? "1 of them is new" : `${count} of them are new`;
  await expect(byText(page, caption)).toBeVisible();
});

/** A day in the week strip, by its label, e.g. "Today, practised". */
Then("the week shows {string}", async ({ page }, description: string) => {
  await expect(byLabelIn(page, TestIds.HOME_WEEK, description)).toBeVisible();
});

/** The words card's progress bar, by its label, e.g. "0 known, 1 learning, 0 new". */
Then("my words read {string}", async ({ page }, description: string) => {
  await expect(byLabelIn(page, TestIds.HOME_PROGRESS, description)).toBeVisible();
});
