import { expect, type Page } from "@playwright/test";
import { TestIds } from "../../../src/ui/testIds";
import { byTestId } from "../selectors";
import { home } from "./home";

export const settings = {
  newWordsValue: (page: Page) => byTestId(page, TestIds.SETTINGS_NEW_WORDS_VALUE),
  newWordsDecrease: (page: Page) => byTestId(page, TestIds.SETTINGS_NEW_WORDS_DECREASE),
  newWordsIncrease: (page: Page) => byTestId(page, TestIds.SETTINGS_NEW_WORDS_INCREASE),

  reminderSwitch: (page: Page) => byTestId(page, TestIds.SETTINGS_REMINDER_SWITCH),

  /** Opens Settings from any screen, or stays put if it is already open. */
  open: async (page: Page): Promise<void> => {
    if (await settings.newWordsValue(page).isVisible()) return;
    await home.openViaMenu(page, "Settings");
    await settings.newWordsValue(page).waitFor();
  },

  setNewWordsPerDay: async (page: Page, target: number): Promise<void> => {
    let current = Number(await settings.newWordsValue(page).innerText());
    while (current < target) {
      await settings.newWordsIncrease(page).click();
      current++;
      await expect(settings.newWordsValue(page)).toHaveText(String(current));
    }
    while (current > target) {
      await settings.newWordsDecrease(page).click();
      current--;
      await expect(settings.newWordsValue(page)).toHaveText(String(current));
    }
  },
};
