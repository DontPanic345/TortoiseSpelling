import type { Locator, Page } from "@playwright/test";

/** The visible elements whose whole text is `text`, as UiSelector's `text()` matches. */
export const visibleText = (page: Page, text: string): Locator =>
  page.getByText(text, { exact: true }).filter({ visible: true });

/** The first visible element whose whole text is `text`. Absence is `toHaveCount(0)` on `visibleText`. */
export const byText = (page: Page, text: string): Locator => visibleText(page, text).first();

export const byTestId = (page: Page, id: string): Locator => page.getByTestId(id);

/** An element inside the tagged one by its accessible label, e.g. a week dot or the progress bar. */
export const byLabelIn = (page: Page, id: string, label: string): Locator =>
  byTestId(page, id).getByLabel(label, { exact: true });

/** The first visible button, menu item or link named exactly `label`: what "I choose" taps. */
export const choice = (page: Page, label: string): Locator =>
  page
    .getByRole("button", { name: label, exact: true })
    .or(page.getByRole("menuitem", { name: label, exact: true }))
    .or(page.getByRole("link", { name: label, exact: true }))
    .filter({ visible: true })
    .first();
