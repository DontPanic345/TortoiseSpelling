import { expect } from "@playwright/test";
import { lookupAnswers } from "../../specs/support/fixtures";
import { Then, When } from "./support/fixtures";
import { addWord } from "./support/screens/addWord";
import { byText } from "./support/selectors";

When("I copy the lookup prompt", async ({ page }) => {
  await addWord.copyPromptButton(page).click();
});

Then("the clipboard holds the lookup prompt for {string}", async ({ page, browserName }, word: string) => {
  // Playwright can't read the clipboard in WebKit, so there the check is the app's own message
  // that the write succeeded.
  if (browserName === "webkit") {
    await expect(byText(page, "Prompt copied.")).toBeVisible();
    return;
  }
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain(`I'm learning to spell "${word}".`);
});

When("I paste the chat's answer for {string}", async ({ page }, word: string) => {
  const answer = lookupAnswers[word];
  if (answer === undefined) throw new Error(`No lookup answer for "${word}" in specs/support/fixtures.ts`);
  await addWord.pasteAnswer(page, answer);
});

When("I use the answer", async ({ page }) => {
  await addWord.useAnswer(page);
});
