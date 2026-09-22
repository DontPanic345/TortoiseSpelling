import { Then, When } from '@wdio/cucumber-framework';
import { expect } from '@wdio/globals';
import { home } from '../support/screens/home.ts';
import { byTestIdWithDescendantDescription, byText, scrollToTestId } from '../support/selectors.ts';
import { testIds } from '../support/testIds.ts';

When('I go back to Home', async () => {
    await home.goBack();
});

Then('I am on Home', async () => {
    await expect(home.title()).toBeDisplayed();
});

Then('Home shows {int} word(s) to practise today', async (count: number) => {
    await expect(home.practiceCount()).toHaveText(String(count));
    const caption = count === 1 ? 'word to practise today' : 'words to practise today';
    await expect(byText(caption)).toBeDisplayed();
});

Then('{int} of them is/are new', async (count: number) => {
    const caption = count === 1 ? '1 of them is new' : `${count} of them are new`;
    await expect(byText(caption)).toBeDisplayed();
});

/** A day in the week strip, by its description, e.g. "Today, practised". */
Then('the week shows {string}', async (description: string) => {
    await scrollToTestId(testIds.homeWeek);
    await expect(byTestIdWithDescendantDescription(testIds.homeWeek, description)).toBeDisplayed();
});

/** The words card's progress bar, by its description, e.g. "0 known, 1 learning, 0 new". */
Then('my words read {string}', async (description: string) => {
    await scrollToTestId(testIds.homeProgress);
    await expect(byTestIdWithDescendantDescription(testIds.homeProgress, description)).toBeDisplayed();
});
