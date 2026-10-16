import { expect, type Page } from "@playwright/test";
import { TestIds, wordFilter, wordRow, wordRowStatus } from "../../../src/ui/testIds";
import { normalizeWord } from "../normalizeWord";
import { byTestId } from "../selectors";
import { addWord } from "./addWord";
import { home } from "./home";

export const wordList = {
  searchField: (page: Page) => byTestId(page, TestIds.WORD_LIST_SEARCH),
  /** A filter chip, by its label, e.g. "Due" -> the chip tagged word_filter_due. */
  filterChip: (page: Page, label: string) => byTestId(page, wordFilter(label.toLowerCase())),
  row: (page: Page, word: string) => byTestId(page, wordRow(normalizeWord(word))),
  suspendButton: (page: Page, word: string) => wordList.row(page, word).getByRole("button", { name: "Suspend word" }),
  deleteButton: (page: Page, word: string) => wordList.row(page, word).getByRole("button", { name: "Delete word" }),
  rowStatus: (page: Page, word: string) => byTestId(page, wordRowStatus(normalizeWord(word))),

  /** Opens the word list from any screen, or stays put if it is already open. */
  open: async (page: Page): Promise<void> => {
    await home.openViaMenu(page, "All words");
  },

  search: async (page: Page, query: string): Promise<void> => {
    await wordList.searchField(page).fill(query);
  },

  filterBy: async (page: Page, label: string): Promise<void> => {
    await wordList.filterChip(page, label).click();
  },

  suspend: async (page: Page, word: string): Promise<void> => {
    await wordList.suspendButton(page, word).click();
  },

  askToDelete: async (page: Page, word: string): Promise<void> => {
    await wordList.deleteButton(page, word).click();
  },

  /** Opens a row's edit screen and waits for its fields to load from the database (they start blank). */
  openWord: async (page: Page, word: string): Promise<void> => {
    await wordList.row(page, word).getByRole("button").first().click();
    await expect(addWord.wordField(page)).toHaveValue(word);
  },
};
