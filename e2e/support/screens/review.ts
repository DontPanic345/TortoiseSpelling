import { typeInto } from '../actions.ts';
import { scenarioState } from '../scenarioState.ts';
import { byDescription, byTestId, byText } from '../selectors.ts';
import { testIds } from '../testIds.ts';

export const review = {
    answerField: () => byTestId(testIds.reviewAnswer),
    submitButton: () => byTestId(testIds.reviewSubmit),
    endSessionButton: () => byDescription('End session'),
    /** The word shown in the hit card, below its small "Correct" label. */
    correctWord: () => byTestId(testIds.reviewCorrectWord),

    /** Types an answer and submits it, without waiting for the outcome. */
    answer: async (attempt: string): Promise<void> => {
        await typeInto(review.answerField(), attempt);
        await review.submitButton().click();
    },

    /**
     * The word currently on screen, found by matching the shown definition against
     * what this scenario has added. The review screen shows only the definition, not
     * the word itself, so this is how "the current word" steps know what to type.
     */
    currentWord: async (): Promise<string> => {
        const source = await driver.getPageSource();
        const added = scenarioState.addedWords().find(({ definition }) => source.includes(definition));
        if (!added) {
            throw new Error('Could not tell which added word is currently shown for review.');
        }
        return added.word;
    },

    /** Answers every word left in the session correctly, arranging for a Given step. */
    practiceAllCorrectly: async (): Promise<void> => {
        const maxWords = 50;
        for (let attempt = 0; attempt < maxWords; attempt++) {
            const finished = await byText('All done — see you tomorrow').isDisplayed().catch(() => false);
            if (finished) {
                return;
            }
            await review.answerField().waitForDisplayed();
            const word = await review.currentWord();
            await review.answer(word);
            await driver.waitUntil(
                async () => (await review.correctWord().getText().catch(() => '')) === word,
                { timeoutMsg: `"${word}" was not marked correct` },
            );
            // The button now reads "Continue"; tapping it advances immediately rather
            // than waiting out the ~1.1s auto-advance.
            await review.submitButton().click();
        }
        throw new Error('practiceAllCorrectly did not reach the finish line');
    },
};
