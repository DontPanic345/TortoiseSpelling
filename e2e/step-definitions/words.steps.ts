import { DataTable, Given, Then, When } from '@wdio/cucumber-framework';
import { expect } from '@wdio/globals';
import { fieldValue, typeInto } from '../support/actions.ts';
import { scenarioState } from '../support/scenarioState.ts';
import { addWord } from '../support/screens/addWord.ts';
import { seedWords } from '../support/seed.ts';
import { wordList } from '../support/screens/wordList.ts';
import { byText } from '../support/selectors.ts';

Given('I have no words yet', async () => {
    await expect(byText('No words yet')).toBeDisplayed();
});

/** Arrange: seeded rather than typed, see seedWords. */
Given('I have added the word {string} defined as {string}', async (word: string, definition: string) => {
    await seedWords([{ word, definition }]);
    scenarioState.recordAddedWord({ word, definition });
});

Given(
    'I have added the word {string} defined as {string} with the example {string}',
    async (word: string, definition: string, example: string) => {
        await seedWords([{ word, definition, example }]);
        scenarioState.recordAddedWord({ word, definition });
    },
);

Given('I have added these words:', async (dataTable: DataTable) => {
    const words = dataTable.hashes().map((row) => ({ word: row.word, definition: row.definition }));
    await seedWords(words);
    words.forEach((word) => scenarioState.recordAddedWord(word));
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

// --- word list ---

Given('I open the word list', async () => {
    await wordList.open();
});

When('I search for {string}', async (query: string) => {
    await wordList.search(query);
});

When('I filter by {string}', async (label: string) => {
    await wordList.filterBy(label);
});

Then('{string} is listed', async (word: string) => {
    await expect(byText(word)).toBeDisplayed();
});

Then('{string} is not listed', async (word: string) => {
    await expect(byText(word)).not.toBeDisplayed();
});

Then('{string} is listed as {string}', async (word: string, status: string) => {
    await expect(byText(word)).toBeDisplayed();
    await expect(wordList.rowStatus(word)).toHaveText(status);
});

Then('{string} is listed with the definition {string}', async (word: string, definition: string) => {
    await expect(byText(word)).toBeDisplayed();
    await expect(byText(definition)).toBeDisplayed();
});

When('I suspend {string}', async (word: string) => {
    await wordList.suspend(word);
});

When('I ask to delete {string}', async (word: string) => {
    await wordList.askToDelete(word);
});

When('I open {string}', async (word: string) => {
    await wordList.openWord(word);
});

When('I change the definition to {string}', async (definition: string) => {
    await typeInto(addWord.definitionField(), definition);
});

When('I save the changes', async () => {
    await addWord.save();
});
