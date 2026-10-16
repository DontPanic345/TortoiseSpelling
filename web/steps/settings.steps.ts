import { Given } from "./support/fixtures";
import { settings } from "./support/screens/settings";

Given("new words per day is set to {int}", async ({ page }, target: number) => {
  await settings.open(page);
  await settings.setNewWordsPerDay(page, target);
});
