/**
 * Scenario-scoped memory for steps that need to recall something from earlier in the
 * same scenario: which words were added and their definitions, or which notification
 * was last seen. Cleared in the Before hook so scenarios never see another's leftovers.
 */
export interface AddedWord {
    word: string;
    definition: string;
}

interface ScenarioState {
    /** Words added this scenario, in the order they were added. */
    addedWords: AddedWord[];
    /** The title of the last notification a step confirmed arrived, for "I tap that notification". */
    lastNotificationTitle: string | undefined;
}

const state: ScenarioState = {
    addedWords: [],
    lastNotificationTitle: undefined,
};

export const scenarioState = {
    reset: (): void => {
        state.addedWords = [];
        state.lastNotificationTitle = undefined;
    },

    recordAddedWord: (word: AddedWord): void => {
        state.addedWords.push(word);
    },

    addedWords: (): AddedWord[] => state.addedWords,

    setLastNotificationTitle: (title: string): void => {
        state.lastNotificationTitle = title;
    },

    lastNotificationTitle: (): string => {
        if (state.lastNotificationTitle === undefined) {
            throw new Error('No notification has been confirmed to arrive yet this scenario.');
        }
        return state.lastNotificationTitle;
    },
};
