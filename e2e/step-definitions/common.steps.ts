import { Then } from '@wdio/cucumber-framework';
import { expect } from '@wdio/globals';
import { byText } from '../support/selectors.ts';

// Steps about what is on screen, shared by every feature. Keep them phrased from the
// user's side ("I am told", "I see") so feature files read as behaviour, not UI.

/** For transient messages: snackbars and inline confirmations. */
Then('I am told {string}', async (message: string) => {
    await expect(byText(message)).toBeDisplayed();
});

Then('I see {string}', async (text: string) => {
    await expect(byText(text)).toBeDisplayed();
});
