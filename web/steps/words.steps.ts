import { expect } from "@playwright/test";
import type { DataTable } from "playwright-bdd";
import { Given, Then, When } from "./support/fixtures";
import { addWord } from "./support/screens/addWord";
import { wordList } from "./support/screens/wordList";
import { seedWords } from "./support/seed";
import { byText } from "./support/selectors";

Given("I have no words yet", async ({ page }) => {
  await expect(byText(page, "No words yet")).toBeVisible();
});

/** Arrange: seeded rather than typed, see seedWords. */
Given(
  "I have added the word {string} defined as {string}",
  async ({ page, scenario }, word: string, definition: string) => {
    await seedWords(page, [{ word, definition }]);
    scenario.addedWords.push({ word, definition });
  },
);

Given(
  "I have added the word {string} defined as {string} with the example {string}",
  async ({ page, scenario }, word: string, definition: string, example: string) => {
    await seedWords(page, [{ word, definition, example }]);
    scenario.addedWords.push({ word, definition });
  },
);

Given("I have added these words:", async ({ page, scenario }, dataTable: DataTable) => {
  const words = dataTable.hashes().map((row) => ({ word: row["word"] ?? "", definition: row["definition"] ?? "" }));
  await seedWords(page, words);
  scenario.addedWords.push(...words);
});

/** Act: the outcome (added, or refused as a duplicate) is left to the Then steps. */
When("I add the word {string} defined as {string}", async ({ page }, word: string, definition: string) => {
  await addWord.open(page);
  await addWord.fill(page, { word, definition });
  await addWord.save(page);
});

Then("the add-word form is cleared, ready for the next word", async ({ page }) => {
  await expect(addWord.wordField(page)).toHaveValue("");
  await expect(addWord.definitionField(page)).toHaveValue("");
});

// --- word list ---

Given("I open the word list", async ({ page }) => {
  await wordList.open(page);
});

Then("{string} is listed as {string}", async ({ page }, word: string, status: string) => {
  await expect(byText(page, word)).toBeVisible();
  await expect(wordList.rowStatus(page, word)).toHaveText(status);
});
