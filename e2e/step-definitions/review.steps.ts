import { Given, Then, When } from '@wdio/cucumber-framework';
import { expect } from '@wdio/globals';
import { home } from '../support/screens/home.ts';
import { review } from '../support/screens/review.ts';
import { byText } from '../support/selectors.ts';

When('I start today\'s session', async () => {
    await home.startSession();
    await review.answerField().waitForDisplayed();
});

Then('the session title reads {string}', async (title: string) => {
    await expect(byText(title)).toBeDisplayed();
});

Then('I am shown the definition {string}', async (definition: string) => {
    await expect(byText(definition)).toBeDisplayed();
});

Then('the example reads {string}', async (example: string) => {
    await expect(byText(example)).toBeDisplayed();
});

/** The hit card: a small "Correct" label above the word, in the feedback colour. */
Then('I am told the correct word {string}', async (word: string) => {
    await expect(byText('Correct')).toBeDisplayed();
    await expect(review.correctWord()).toHaveText(word);
});

/** Act only, and quick: a correct answer auto-advances after ~1.1s. */
When('I spell it {string}', async (attempt: string) => {
    await review.answer(attempt);
});

When('I retype it as {string}', async (attempt: string) => {
    await review.answer(attempt);
});

Then('I see my attempt {string} beside the correct spelling {string}', async (attempt: string, correct: string) => {
    await expect(byText('You typed')).toBeDisplayed();
    await expect(byText(attempt)).toBeDisplayed();
    await expect(byText('Correct')).toBeDisplayed();
    await expect(byText(correct)).toBeDisplayed();
});

Then('the session moves on by itself to the finish line', async () => {
    await byText('All done — see you tomorrow').waitForDisplayed();
});

/** Arrange: plays out every word left in today's session, correctly. */
Given('I have practised today\'s words correctly', async () => {
    await home.goBack();
    await home.startSession();
    await review.practiceAllCorrectly();
});
