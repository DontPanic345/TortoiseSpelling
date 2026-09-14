import { Given, Then, When } from '@wdio/cucumber-framework';
import { expect } from '@wdio/globals';
import { fieldValue } from '../support/actions.ts';
import { addWord } from '../support/screens/addWord.ts';
import { home } from '../support/screens/home.ts';
import { settings } from '../support/screens/settings.ts';
import { scrollToTestId } from '../support/selectors.ts';
import { testIds } from '../support/testIds.ts';

// @live-api only: never run against the emulator (see e2e/README.md). Verified with
// `npm run check-steps -- --all` only.

Given('my Anthropic API key is saved in Settings', async () => {
    const apiKey = process.env.TORTOISESPELLING_ANTHROPIC_KEY;
    if (!apiKey) {
        throw new Error(
            'TORTOISESPELLING_ANTHROPIC_KEY is not set — this scenario needs a real Anthropic key.',
        );
    }
    await settings.open();
    // The Claude lookup section is below the fold now that Settings leads with Daily
    // reminder and Practice.
    await scrollToTestId(testIds.settingsApiKey);
    // mask keeps the key out of WebdriverIO's own logs; appium-log-filters.json covers
    // the Appium server's.
    await settings.apiKeyField().setValue(apiKey, { mask: true });
    await home.goBack();
});

When('I look it up with Claude', async () => {
    await addWord.lookUpButton().click();
});

Then('the definition is filled in', async () => {
    await driver.waitUntil(async () => (await fieldValue(addWord.definitionField())) !== '', {
        timeout: 15_000,
        timeoutMsg: 'Claude did not fill in a definition',
    });
});

Then('the example contains {string}', async (substring: string) => {
    const example = await fieldValue(addWord.exampleField());
    expect(example).toContain(substring);
});

Then('the part of speech reads {string}', async (partOfSpeech: string) => {
    expect(await fieldValue(addWord.partOfSpeechField())).toBe(partOfSpeech);
});

Then('the word reads {string}', async (word: string) => {
    expect(await fieldValue(addWord.wordField())).toBe(word);
});
