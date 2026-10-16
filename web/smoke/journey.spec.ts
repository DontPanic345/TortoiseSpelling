import { expect, test } from "./fixtures";
import { addWordByHand } from "./helpers";

test("first run, add a word, review it, and it is still there after a reload", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByText("No words yet")).toBeVisible();

  await addWordByHand(page, "rhythm");
  await page.goto("./#/");
  await expect(page.getByTestId("home_practice_count")).toHaveText("1");
  await expect(page.getByText("word to practise today")).toBeVisible();

  await page.getByRole("button", { name: "Start" }).click();
  await page.getByTestId("review_answer").fill("rhythm");
  await page.getByTestId("review_submit").click();
  await expect(page.getByTestId("review_correct_word")).toBeVisible();
  await expect(page.getByText("You practised 1 word today.")).toBeVisible();

  await page.goto("./#/");
  await page.reload();
  await expect(page.getByText(/^All done/)).toBeVisible();
  await page.goto("./#/words");
  await expect(page.getByTestId("word_row_rhythm")).toBeVisible();
});
