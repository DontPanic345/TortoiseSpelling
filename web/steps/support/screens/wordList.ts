import type { Page } from "@playwright/test";
import { wordRowStatus } from "../../../src/ui/testIds";
import { normalizeWord } from "../normalizeWord";
import { byTestId } from "../selectors";
import { home } from "./home";

export const wordList = {
  rowStatus: (page: Page, word: string) => byTestId(page, wordRowStatus(normalizeWord(word))),

  /** Opens the word list from any screen, or stays put if it is already open. */
  open: async (page: Page): Promise<void> => {
    await home.openViaMenu(page, "All words");
  },
};
