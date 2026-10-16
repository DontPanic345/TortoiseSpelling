import type { Page } from "@playwright/test";
import { TestIds } from "../../../src/ui/testIds";
import { byTestId } from "../selectors";
import { home } from "./home";

export interface WordFields {
  word: string;
  definition?: string;
  example?: string;
  partOfSpeech?: string;
}

export const addWord = {
  wordField: (page: Page) => byTestId(page, TestIds.ADD_WORD_TEXT),
  definitionField: (page: Page) => byTestId(page, TestIds.ADD_WORD_DEFINITION),
  exampleField: (page: Page) => byTestId(page, TestIds.ADD_WORD_EXAMPLE),
  partOfSpeechField: (page: Page) => byTestId(page, TestIds.ADD_WORD_PART_OF_SPEECH),
  saveButton: (page: Page) => byTestId(page, TestIds.ADD_WORD_SAVE),

  /** Opens the Add word screen from any screen, or stays put if it is already open. */
  open: async (page: Page): Promise<void> => {
    if (await addWord.wordField(page).isVisible()) return;
    await home.goBack(page);
    await home.addWordButton(page).click();
    await addWord.wordField(page).waitFor();
  },

  fill: async (page: Page, fields: WordFields): Promise<void> => {
    await addWord.wordField(page).fill(fields.word);
    if (fields.definition !== undefined) await addWord.definitionField(page).fill(fields.definition);
    if (fields.example !== undefined) await addWord.exampleField(page).fill(fields.example);
    if (fields.partOfSpeech !== undefined) await addWord.partOfSpeechField(page).fill(fields.partOfSpeech);
  },

  save: async (page: Page): Promise<void> => {
    await addWord.saveButton(page).click();
  },
};
