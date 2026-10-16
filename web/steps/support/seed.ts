import type { Page } from "@playwright/test";
import type { SeedWord } from "../../src/debug/seedHook";

/** Adds words through the test build's seed hook, which uses the repository the Add screen does. */
export async function seedWords(page: Page, words: SeedWord[]): Promise<void> {
  await page.waitForFunction(() => typeof window.__tortoiseSpellingSeed === "function");
  await page.evaluate((toSeed) => window.__tortoiseSpellingSeed?.(toSeed), words);
}
