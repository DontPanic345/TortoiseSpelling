import { expect } from "@playwright/test";
import { Given, Then } from "./support/fixtures";
import { settings } from "./support/screens/settings";

Given("I open Settings", async ({ page }) => {
  await settings.open(page);
});

Given("new words per day is set to {int}", async ({ page }, target: number) => {
  await settings.open(page);
  await settings.setNewWordsPerDay(page, target);
});

Then("the daily reminder is {word}", async ({ page }, state: string) => {
  const reminderSwitch = settings.reminderSwitch(page);
  await (state === "on" ? expect(reminderSwitch).toBeChecked() : expect(reminderSwitch).not.toBeChecked());
});
