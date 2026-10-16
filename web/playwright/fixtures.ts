import { expect, test as base, type Page } from "@playwright/test";

type ProblemsFixture = (args: { page: Page }, use: (problems: string[]) => Promise<void>) => Promise<void>;

/**
 * Fails a test on a console error or an uncaught page error, so a CSP violation fails it.
 * `smoke/` extends `@playwright/test`'s `test` with it and `steps/` extends `playwright-bdd`'s.
 * A test that expects one kind of console error passes its pattern as `allowed`.
 */
export function problemsFixtureAllowing(allowed: RegExp[]): [ProblemsFixture, { auto: true }] {
  return [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error" && !allowed.some((pattern) => pattern.test(message.text()))) {
          problems.push(`console: ${message.text()}`);
        }
      });
      page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
      await use(problems);
      expect(problems).toEqual([]);
    },
    { auto: true },
  ];
}

export const problemsFixture = problemsFixtureAllowing([]);

export const test = base.extend<{ problems: string[] }>({ problems: problemsFixture });

export { expect };
