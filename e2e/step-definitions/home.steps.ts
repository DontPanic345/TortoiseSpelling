import { Then, When } from '@wdio/cucumber-framework';
import { expect } from '@wdio/globals';
import { home } from '../support/screens/home.ts';
import { byText } from '../support/selectors.ts';

When('I go back to Home', async () => {
    await home.goBack();
});

Then('I am on Home', async () => {
    await expect(home.title()).toBeDisplayed();
});

Then('Home shows {int} word(s) to practice today', async (count: number) => {
    await expect(home.practiceCount()).toHaveText(String(count));
    const caption = count === 1 ? 'word to practice today' : 'words to practice today';
    await expect(byText(caption)).toBeDisplayed();
});

Then('{int} of them is/are new', async (count: number) => {
    const caption = count === 1 ? '1 of them is new' : `${count} of them are new`;
    await expect(byText(caption)).toBeDisplayed();
});
