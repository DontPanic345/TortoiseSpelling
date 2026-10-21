/**
 * Single-line JSON answers a chat AI might give, keyed by word. Single-line because
 * UiAutomator2's setValue may turn a newline into Enter. "practice" is
 * docs/copy-prompt-lookup.md's example, fenced as a chat app would fence it.
 */
const practice = {
    word: 'practice',
    definitions: [
        {
            text: 'repeated exercise to improve a skill',
            partOfSpeech: 'noun',
            forms: [
                { text: 'practice', label: 'singular', examples: ['She has piano practice on Tuesdays.'] },
                { text: 'practices', label: 'plural', examples: ['He runs two medical practices.'] },
            ],
        },
        {
            text: 'to perform an activity repeatedly to improve at it',
            partOfSpeech: 'verb',
            forms: [
                { text: 'practise', label: 'base', examples: ['I practise every day.'] },
                { text: 'practised', label: 'past tense', examples: ['He practised for hours.'] },
            ],
        },
    ],
};

/** Its second form is two words, which the form warnings flag. */
const curious = {
    word: 'curious',
    definitions: [
        {
            text: 'eager to know or learn something',
            partOfSpeech: 'adjective',
            forms: [
                { text: 'curious', label: 'base', examples: ['A curious cat looked in.'] },
                { text: 'most curious', label: 'superlative', examples: ['She is the most curious child in the class.'] },
            ],
        },
    ],
};

export const lookupAnswers: Record<string, string> = {
    practice: '```json ' + JSON.stringify(practice) + ' ```',
    curious: JSON.stringify(curious),
};

export interface BackupWordSpec {
    text: string;
    definition: string;
}

/** Builds the flat (pre-tree) on-disk backup JSON (data/Backup.kt): version, exportedAt, words[]. */
export const flatBackupFile = (words: BackupWordSpec[]): string =>
    JSON.stringify({
        version: 1,
        exportedAt: Date.now(),
        words: words.map((word) => ({
            text: word.text,
            definition: word.definition,
            example: '',
            partOfSpeech: null,
            createdAt: Date.now(),
            repetitions: 0,
            easeFactor: 2.5,
            intervalDays: 0,
            dueOn: 0,
            lapses: 0,
            lastReviewedAt: null,
            firstReviewedOn: null,
            isNew: true,
            suspended: false,
        })),
    });
