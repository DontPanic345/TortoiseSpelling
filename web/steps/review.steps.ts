import { expect } from "@playwright/test";
import { Given, Then, When } from "./support/fixtures";
import { home } from "./support/screens/home";
import { FINISH_LINE, review } from "./support/screens/review";
import { byText, visibleText } from "./support/selectors";

When("I start today's session", async ({ page }) => {
  await home.startSession(page);
  await expect(review.answerField(page)).toBeVisible();
});

Then("the session title reads {string}", async ({ page }, title: string) => {
  await expect(byText(page, title)).toBeVisible();
});

Then("I am shown the definition {string}", async ({ page }, definition: string) => {
  await expect(byText(page, definition)).toBeVisible();
});

Then("the example reads {string}", async ({ page }, example: string) => {
  // The blank is drawn as an underline with the placeholder as visually hidden text, so the
  // sentence's text content, not its rendered text, is what reads "_____" (or the word).
  await expect(page.locator("p.example")).toHaveText(example);
});

/** The hit card: a small "Correct" label above the word, in the feedback colour. */
Then("I am told the correct word {string}", async ({ page }, word: string) => {
  await expect(byText(page, "Correct")).toBeVisible();
  await expect(review.correctWord(page)).toHaveText(word);
});

/** Act only, and quick: a correct answer auto-advances after ~1.1s. */
When("I spell it {string}", async ({ page }, attempt: string) => {
  await review.answer(page, attempt);
});

When("I retype it as {string}", async ({ page }, attempt: string) => {
  await review.answer(page, attempt);
});

Then(
  "I see my attempt {string} beside the correct spelling {string}",
  async ({ page }, attempt: string, correct: string) => {
    await expect(byText(page, "You typed")).toBeVisible();
    await expect(byText(page, attempt)).toBeVisible();
    await expect(byText(page, "Correct")).toBeVisible();
    await expect(byText(page, correct)).toBeVisible();
  },
);

Then("I see my attempt {string} with the answer hidden", async ({ page }, attempt: string) => {
  await expect(byText(page, "You typed")).toBeVisible();
  await expect(byText(page, attempt)).toBeVisible();
  await expect(byText(page, "Show answer")).toBeVisible();
  await expect(visibleText(page, "Correct")).toHaveCount(0);
});

Then("the session moves on by itself to the finish line", async ({ page }) => {
  await expect(byText(page, FINISH_LINE)).toBeVisible();
});

/** Arrange: plays out every word left in today's session, correctly. */
Given("I have practised today's words correctly", async ({ page, scenario }) => {
  await home.goBack(page);
  await home.startSession(page);
  await review.practiceAllCorrectly(page, scenario);
});
