import { expect, type Page } from "@playwright/test";
import { TestIds, addWordAddForm, addWordExample, addWordFormLabel, addWordFormText } from "../../../src/ui/testIds";
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
  copyPromptButton: (page: Page) => byTestId(page, TestIds.ADD_WORD_COPY_PROMPT),
  pasteButton: (page: Page) => byTestId(page, TestIds.ADD_WORD_PASTE),
  pasteField: (page: Page) => byTestId(page, TestIds.ADD_WORD_PASTE_TEXT),
  pasteUseButton: (page: Page) => byTestId(page, TestIds.ADD_WORD_PASTE_USE),

  /** Opens the Paste answer dialog and fills in the answer, waiting until it is accepted. */
  pasteAnswer: async (page: Page, answer: string): Promise<void> => {
    await addWord.pasteButton(page).click();
    await addWord.pasteField(page).fill(answer);
    await expect(addWord.pasteUseButton(page), "Use this stayed disabled: the pasted answer was not accepted").toBeEnabled();
  },

  useAnswer: async (page: Page): Promise<void> => {
    await addWord.pasteUseButton(page).click();
    await expect(addWord.pasteField(page), "The Paste answer dialog did not close").toBeHidden();
  },

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

  /**
   * Adds a form with one example to the first definition. The new form is the last one of
   * definition 0, so `position` is its index there (the base form is 0).
   */
  addForm: async (page: Page, position: number, form: string, label: string, example: string): Promise<void> => {
    await byTestId(page, addWordAddForm(0)).click();
    await byTestId(page, addWordFormText(0, position)).fill(form);
    await byTestId(page, addWordFormLabel(0, position)).fill(label);
    await byTestId(page, addWordExample(0, position, 0)).fill(example);
  },

  save: async (page: Page): Promise<void> => {
    await addWord.saveButton(page).click();
  },
};
