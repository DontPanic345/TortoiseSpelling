import { fieldValue, typeInto } from '../actions.ts';
import { byTestId } from '../selectors.ts';
import { testIds } from '../testIds.ts';
import { home } from './home.ts';

export interface WordFields {
    word: string;
    definition?: string;
    example?: string;
    partOfSpeech?: string;
}

export const addWord = {
    wordField: () => byTestId(testIds.addWordText),
    definitionField: () => byTestId(testIds.addWordDefinition),
    exampleField: () => byTestId(testIds.addWordExample),
    partOfSpeechField: () => byTestId(testIds.addWordPartOfSpeech),
    saveButton: () => byTestId(testIds.addWordSave),
    /** Tagged because a button's label is a child TextView that is always "enabled". */
    lookUpButton: () => byTestId(testIds.addWordLookUp),

    /** Opens the Add word screen from any screen, or stays put if it is already open. */
    open: async (): Promise<void> => {
        if (await addWord.wordField().isDisplayed()) {
            return;
        }
        await home.goBack();
        await home.addWordButton().click();
        await addWord.wordField().waitForDisplayed();
    },

    fill: async (fields: WordFields): Promise<void> => {
        await typeInto(addWord.wordField(), fields.word);
        if (fields.definition !== undefined) {
            await typeInto(addWord.definitionField(), fields.definition);
        }
        if (fields.example !== undefined) {
            await typeInto(addWord.exampleField(), fields.example);
        }
        if (fields.partOfSpeech !== undefined) {
            await typeInto(addWord.partOfSpeechField(), fields.partOfSpeech);
        }
    },

    save: async (): Promise<void> => {
        await addWord.saveButton().click();
    },

    /** Adds a word and waits for the form to clear, which only happens on success. */
    addAndConfirm: async (fields: WordFields): Promise<void> => {
        await addWord.open();
        await addWord.fill(fields);
        await addWord.save();
        await driver.waitUntil(async () => (await fieldValue(addWord.wordField())) === '', {
            timeoutMsg: `"${fields.word}" was not added: the form did not clear`,
        });
    },
};
