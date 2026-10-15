import { fieldValue, typeInto } from '../actions.ts';
import { byTestId, scrollToTestId } from '../selectors.ts';
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
    copyPromptButton: () => byTestId(testIds.addWordCopyPrompt),
    pasteButton: () => byTestId(testIds.addWordPaste),
    pasteField: () => byTestId(testIds.addWordPasteText),
    pasteUseButton: () => byTestId(testIds.addWordPasteUse),

    /** Opens the Paste answer dialog, types the answer and uses it; the dialog closes. */
    pasteAnswer: async (answer: string): Promise<void> => {
        await addWord.pasteButton().click();
        await addWord.pasteField().waitForDisplayed();
        await typeInto(addWord.pasteField(), answer);
        await driver.waitUntil(async () => addWord.pasteUseButton().isEnabled(), {
            timeoutMsg: 'Use this stayed disabled: the pasted answer was not accepted',
        });
    },

    useAnswer: async (): Promise<void> => {
        await addWord.pasteUseButton().click();
        await driver.waitUntil(async () => !(await addWord.pasteField().isDisplayed()), {
            timeoutMsg: 'The Paste answer dialog did not close',
        });
    },

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

    /**
     * Adds a form with one example to the first definition. The new form is the last one
     * of definition 0, so `position` is its index there (the base form is 0).
     */
    addForm: async (position: number, form: string, label: string, example: string): Promise<void> => {
        await (await scrollToTestId(testIds.addWordAddForm(0))).click();
        await (await scrollToTestId(testIds.addWordFormText(0, position))).waitForDisplayed();
        await typeInto(byTestId(testIds.addWordFormText(0, position)), form);
        await typeInto(byTestId(testIds.addWordFormLabel(0, position)), label);
        await typeInto(
            await scrollToTestId(testIds.addWordExampleAt(0, position, 0)),
            example,
        );
    },

    save: async (): Promise<void> => {
        // The tree editor is long: scroll down until Save is on screen, because
        // UiScrollable.scrollIntoView only searches forward from where the screen is.
        for (let swipes = 0; swipes < 8 && !(await addWord.saveButton().isDisplayed()); swipes++) {
            await driver.execute('mobile: scrollGesture', {
                elementId: (await $('android=new UiSelector().scrollable(true)')).elementId,
                direction: 'down',
                percent: 0.75,
            });
        }
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
