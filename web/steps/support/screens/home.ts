import { expect, type Page } from "@playwright/test";
import { TestIds } from "../../../src/ui/testIds";
import { byTestId, choice } from "../selectors";

const MAX_BACK_PRESSES = 5;

export const home = {
  /** Home is the only screen whose top bar reads "Tortoise Spelling". */
  title: (page: Page) => page.getByRole("heading", { name: "Tortoise Spelling", level: 1 }),
  practiceCount: (page: Page) => byTestId(page, TestIds.HOME_PRACTICE_COUNT),
  addWordButton: (page: Page) => byTestId(page, TestIds.HOME_ADD_WORD),
  moreButton: (page: Page) => page.getByRole("button", { name: "More", exact: true }),
  startButton: (page: Page) => page.getByRole("button", { name: "Start", exact: true }),

  /**
   * Leaves whatever screen is open for Home with the app's own controls (the web has no system
   * Back in an installed iPhone app): closes a dialog with Escape, otherwise presses the visible
   * Back, End session or Done button. Done is Completion's Back.
   */
  goBack: async (page: Page): Promise<void> => {
    for (let presses = 0; presses < MAX_BACK_PRESSES; presses++) {
      if (await home.title(page).isVisible()) return;
      if ((await page.locator("dialog[open]").count()) > 0) {
        await page.keyboard.press("Escape");
        continue;
      }
      const leave = choice(page, "Back").or(choice(page, "End session")).or(choice(page, "Done")).first();
      if (!(await leave.isVisible())) break;
      await leave.click();
    }
    await expect(home.title(page)).toBeVisible();
  },

  /** Home's overflow menu item, reachable from any screen. */
  openViaMenu: async (page: Page, label: string): Promise<void> => {
    await home.goBack(page);
    await home.moreButton(page).click();
    await page.getByRole("menuitem", { name: label, exact: true }).click();
  },

  startSession: async (page: Page): Promise<void> => {
    await home.startButton(page).click();
  },
};
