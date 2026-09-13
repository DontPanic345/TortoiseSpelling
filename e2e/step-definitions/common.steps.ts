import { Then, When } from '@wdio/cucumber-framework';
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

/** Taps any button, menu item or dialog action found by its visible text. */
When('I choose {string}', async (label: string) => {
    await byText(label).click();
});

/** A screen's top app bar title, e.g. "All words (2)", "Edit word". */
Then('the title reads {string}', async (title: string) => {
    await expect(byText(title)).toBeDisplayed();
});
