import { expect, test } from "../playwright/fixtures";

test("Copy prompt puts the lookup prompt on the clipboard", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "Only Chromium lets a test grant and read clipboard permissions");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("./#/add");
  await page.getByTestId("add_word_text").fill("rhythm");
  await page.getByTestId("add_word_copy_prompt").click();
  await expect(page.getByText("Prompt copied.")).toBeVisible();

  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied.startsWith('I\'m learning to spell "rhythm".')).toBe(true);
});
