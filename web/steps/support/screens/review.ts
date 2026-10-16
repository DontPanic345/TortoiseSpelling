import { expect, type Page } from "@playwright/test";
import { TestIds } from "../../../src/ui/testIds";
import type { ScenarioState } from "../fixtures";
import { byTestId, byText } from "../selectors";

export const FINISH_LINE = "All done — see you tomorrow";

export const review = {
  answerField: (page: Page) => byTestId(page, TestIds.REVIEW_ANSWER),
  submitButton: (page: Page) => byTestId(page, TestIds.REVIEW_SUBMIT),
  /** The word shown in the hit card, below its small "Correct" label. */
  correctWord: (page: Page) => byTestId(page, TestIds.REVIEW_CORRECT_WORD),

  /** Types an answer and submits it, without waiting for the outcome. */
  answer: async (page: Page, attempt: string): Promise<void> => {
    await review.answerField(page).fill(attempt);
    await review.submitButton(page).click();
  },

  /**
   * The word currently on screen, found by matching the shown definition against what this
   * scenario has added: the review screen shows the definition, not the word.
   */
  currentWord: async (page: Page, scenario: ScenarioState): Promise<string> => {
    const source = await page.content();
    const added = scenario.addedWords.find(({ definition }) => source.includes(definition));
    if (!added) throw new Error("Could not tell which added word is currently shown for review.");
    return added.word;
  },

  /** Answers every word left in the session correctly, arranging for a Given step. */
  practiceAllCorrectly: async (page: Page, scenario: ScenarioState): Promise<void> => {
    const maxWords = 50;
    for (let attempt = 0; attempt < maxWords; attempt++) {
      if (await byText(page, FINISH_LINE).isVisible()) return;
      await expect(review.answerField(page)).toBeVisible();
      const word = await review.currentWord(page, scenario);
      await review.answer(page, word);
      await expect(review.correctWord(page)).toHaveText(word);
      // The button now reads "Continue"; clicking it advances at once instead of waiting out the
      // auto-advance. The last word has no button: the session closes itself, so there waiting
      // is the only way through.
      if (await review.submitButton(page).isVisible()) {
        await review.submitButton(page).click();
      } else {
        await expect(byText(page, FINISH_LINE)).toBeVisible();
        return;
      }
    }
    throw new Error("practiceAllCorrectly did not reach the finish line");
  },
};
