import { Given, When } from '@wdio/cucumber-framework';
import { backup } from '../support/screens/backup.ts';

Given('Downloads has no Tortoise Spelling test files', async () => {
    await backup.clearTestFiles();
});

Given(
    'Downloads has a backup {string} containing {string} and {string}',
    async (filename: string, firstWord: string, secondWord: string) => {
        await backup.pushWords(filename, [
            { text: firstWord, definition: `definition of ${firstWord}` },
            { text: secondWord, definition: `definition of ${secondWord}` },
        ]);
    },
);

When('I export a backup to Downloads as {string}', async (filename: string) => {
    await backup.export(filename);
});

When('I import {string} from Downloads', async (filename: string) => {
    await backup.import(filename);
});
