import { fieldValue } from '../actions.ts';
import { normalizeWord } from '../normalizeWord.ts';
import { byTestId, byTestIdWithDescendantDescription } from '../selectors.ts';
import { testIds } from '../testIds.ts';
import { addWord } from './addWord.ts';
import { home } from './home.ts';

export const wordList = {
    searchField: () => byTestId(testIds.wordListSearch),
    /** A filter chip, by its label, e.g. "Due" -> the chip tagged word_filter_due. */
    filterChip: (label: string) => byTestId(testIds.wordFilter(label.toLowerCase())),
    row: (word: string) => byTestId(testIds.wordRow(normalizeWord(word))),
    rowStatus: (word: string) => byTestId(testIds.wordRowStatus(normalizeWord(word))),
    suspendIcon: (word: string) =>
        byTestIdWithDescendantDescription(testIds.wordRow(normalizeWord(word)), 'Suspend word'),
    resumeIcon: (word: string) =>
        byTestIdWithDescendantDescription(testIds.wordRow(normalizeWord(word)), 'Resume word'),
    deleteIcon: (word: string) =>
        byTestIdWithDescendantDescription(testIds.wordRow(normalizeWord(word)), 'Delete word'),

    /** Opens the word list from any screen, or stays put if it is already open. */
    open: async (): Promise<void> => {
        await home.openViaMenu('All words');
    },

    search: async (query: string): Promise<void> => {
        await wordList.searchField().setValue(query);
    },

    filterBy: async (label: string): Promise<void> => {
        await wordList.filterChip(label).click();
    },

    suspend: async (word: string): Promise<void> => {
        await wordList.suspendIcon(word).click();
    },

    resume: async (word: string): Promise<void> => {
        await wordList.resumeIcon(word).click();
    },

    askToDelete: async (word: string): Promise<void> => {
        await wordList.deleteIcon(word).click();
    },

    /**
     * Opens a row's edit screen by tapping the row (its test tag, not the word text: a
     * small text node's tap bounds can be stale for a moment after the list appears,
     * where the whole row is a much safer target), and waits for its fields to finish
     * loading from the database (they start blank). The load is a fresh ViewModel doing
     * a Room read on navigation, ordinarily well under a second, but was observed taking
     * noticeably longer once, deep into a long test session on a loaded emulator — the
     * timeout is generous rather than tight so that slowdown does not read as a failure.
     */
    openWord: async (word: string): Promise<void> => {
        await wordList.row(word).click();
        await driver.waitUntil(async () => (await fieldValue(addWord.wordField())) === word, {
            timeout: 30_000,
            timeoutMsg: `The edit screen for "${word}" did not finish loading`,
        });
    },
};
