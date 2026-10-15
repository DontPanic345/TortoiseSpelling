import { Then, When } from '@wdio/cucumber-framework';
import { expect } from '@wdio/globals';
import { lookupAnswers } from '../support/lookupAnswers.ts';
import { addWord } from '../support/screens/addWord.ts';

When('I copy the lookup prompt', async () => {
    await addWord.copyPromptButton().click();
});

Then('the clipboard holds the lookup prompt for {string}', async (word: string) => {
    const clipboard = Buffer.from(await driver.getClipboard('plaintext'), 'base64').toString('utf8');
    expect(clipboard).toContain(`I'm learning to spell "${word}".`);
});

When("I paste the chat's answer for {string}", async (word: string) => {
    const answer = lookupAnswers[word];
    if (answer === undefined) {
        throw new Error(`No lookup answer for "${word}" in support/lookupAnswers.ts`);
    }
    await addWord.pasteAnswer(answer);
});

When('I use the answer', async () => {
    await addWord.useAnswer();
});
