import type { Page } from "@playwright/test";

/** Adds a word by hand, through the Add word screen. */
export async function addWordByHand(page: Page, word: string): Promise<void> {
  await page.goto("./#/add");
  await page.getByTestId("add_word_text").fill(word);
  await page.getByTestId("add_word_definition").fill("A strong, regular pattern of sound or movement.");
  await page.getByTestId("add_word_example").fill(`The ${word} of the drums was steady.`);
  await page.getByTestId("add_word_save").click();
  await page.getByText("Added ✓ (", { exact: false }).waitFor();
}
