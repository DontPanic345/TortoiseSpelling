import fs from "node:fs/promises";
import { createBdd, test as base } from "playwright-bdd";
import { problemsFixture } from "../../playwright/fixtures";

export interface AddedWord {
  word: string;
  definition: string;
}

/** Scenario-scoped memory, as `e2e/support/scenarioState.ts`: fresh for every scenario. */
export interface ScenarioState {
  /** Words added this scenario, in the order they were added. */
  addedWords: AddedWord[];
}

export const test = base.extend<{ problems: string[]; scenario: ScenarioState; downloads: string }>({
  problems: problemsFixture,
  // eslint-disable-next-line no-empty-pattern
  scenario: async ({}, use) => {
    await use({ addedWords: [] });
  },
  downloads: async ({}, use, testInfo) => {
    const folder = testInfo.outputPath("downloads");
    await fs.rm(folder, { recursive: true, force: true });
    await fs.mkdir(folder, { recursive: true });
    await use(folder);
  },
});

export const { Given, When, Then, Before } = createBdd(test);
