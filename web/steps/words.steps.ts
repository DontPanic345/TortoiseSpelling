import { expect } from "@playwright/test";
import type { DataTable } from "playwright-bdd";
import { Given, Then, When } from "./support/fixtures";
import { addWord } from "./support/screens/addWord";
import { wordList } from "./support/screens/wordList";
import { seedWords } from "./support/seed";
import { byText, visibleText } from "./support/selectors";

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

When("I start adding the word {string} without a definition", async ({ page }, word: string) => {
  await addWord.open(page);
  await addWord.fill(page, { word });
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

When("I search for {string}", async ({ page }, query: string) => {
  await wordList.search(page, query);
});

When("I filter by {string}", async ({ page }, label: string) => {
  await wordList.filterBy(page, label);
});

Then("{string} is listed", async ({ page }, word: string) => {
  await expect(byText(page, word)).toBeVisible();
});

Then("{string} is not listed", async ({ page }, word: string) => {
  await expect(visibleText(page, word)).toHaveCount(0);
});

Then("{string} is listed with the definition {string}", async ({ page }, word: string, definition: string) => {
  await expect(byText(page, word)).toBeVisible();
  await expect(byText(page, definition)).toBeVisible();
});

When("I suspend {string}", async ({ page }, word: string) => {
  await wordList.suspend(page, word);
});

When("I ask to delete {string}", async ({ page }, word: string) => {
  await wordList.askToDelete(page, word);
});

When("I open {string}", async ({ page }, word: string) => {
  await wordList.openWord(page, word);
});

When("I change the definition to {string}", async ({ page }, definition: string) => {
  await addWord.definitionField(page).fill(definition);
});

When(
  "I add the form {string} labelled {string} with the example {string}",
  async ({ page }, form: string, label: string, example: string) => {
    await addWord.addForm(page, 1, form, label, example);
  },
);

When("I save the changes", async ({ page }) => {
  await addWord.save(page);
});
