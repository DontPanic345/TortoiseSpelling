import { expect, test } from "../playwright/fixtures";
import { addWordByHand } from "./helpers";

test("after the first load the app opens and works with no connection", async ({ page, context }) => {
  await page.goto("./");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("No words yet")).toBeVisible();

  await addWordByHand(page, "rhythm");
  await page.goto("./#/");
  await page.reload();
  await expect(page.getByTestId("home_practice_count")).toHaveText("1");
});
