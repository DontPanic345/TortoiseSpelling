import { byTestId, byText } from '../selectors.ts';
import { testIds } from '../testIds.ts';

const MAX_BACK_PRESSES = 5;

export const home = {
    /** Home is the only screen whose top bar reads "TortoiseSpelling". */
    title: () => byText('TortoiseSpelling'),
    practiceCount: () => byTestId(testIds.homePracticeCount),
    addWordButton: () => byTestId(testIds.homeAddWord),

    /**
     * System Back until Home is showing. Back also dismisses the keyboard, snackbars
     * and dialogs on the way, so it may take more than one press per screen.
     */
    goBack: async (): Promise<void> => {
        for (let presses = 0; presses < MAX_BACK_PRESSES; presses++) {
            if (await home.title().isDisplayed()) {
                return;
            }
            await driver.back();
        }
        await home.title().waitForDisplayed();
    },
};
