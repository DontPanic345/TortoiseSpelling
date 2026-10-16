import { expect, test as base } from "@playwright/test";

/** Every test fails on a console error or an uncaught page error, so a CSP violation fails it. */
export const test = base.extend<{ problems: string[] }>({
  problems: [
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
  ],
});

export { expect };
