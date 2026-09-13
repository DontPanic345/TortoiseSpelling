import { Given, Then, When } from '@wdio/cucumber-framework';
import { expect } from '@wdio/globals';
import { fieldValue } from '../support/actions.ts';
import { addWord } from '../support/screens/addWord.ts';
import { byText } from '../support/selectors.ts';

Given('I have no words yet', async () => {
    await expect(byText('No words yet')).toBeDisplayed();
});

/** Arrange: the word must end up in the list, so this waits for the form to clear. */
Given('I have added the word {string} defined as {string}', async (word: string, definition: string) => {
    await addWord.addAndConfirm({ word, definition });
});

/** Act: the outcome (added, or refused as a duplicate) is left to the Then steps. */
When('I add the word {string} defined as {string}', async (word: string, definition: string) => {
    await addWord.open();
    await addWord.fill({ word, definition });
    await addWord.save();
});

When('I start adding the word {string} without a definition', async (word: string) => {
    await addWord.open();
    await addWord.fill({ word });
});

Then('the add-word form is cleared, ready for the next word', async () => {
    expect(await fieldValue(addWord.wordField())).toBe('');
    expect(await fieldValue(addWord.definitionField())).toBe('');
});

Then('I cannot save the word', async () => {
    await expect(addWord.saveButton()).toBeDisabled();
});

Then('looking it up with Claude is unavailable', async () => {
    await expect(addWord.lookUpButton()).toBeDisabled();
});
