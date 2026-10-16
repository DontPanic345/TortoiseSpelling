import { expect, test as base, type Page } from "@playwright/test";

type ProblemsFixture = (args: { page: Page }, use: (problems: string[]) => Promise<void>) => Promise<void>;

/**
 * Fails a test on a console error or an uncaught page error, so a CSP violation fails it.
 * `smoke/` extends `@playwright/test`'s `test` with it and `steps/` extends `playwright-bdd`'s.
 */
export const problemsFixture: [ProblemsFixture, { auto: true }] = [
  async ({ page }, use) => {
    const problems: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") problems.push(`console: ${message.text()}`);
    });
    page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
    await use(problems);
    expect(problems).toEqual([]);
  },
  { auto: true },
];

export const test = base.extend<{ problems: string[] }>({ problems: problemsFixture });

export { expect };
