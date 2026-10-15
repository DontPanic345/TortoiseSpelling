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

export const lookupAnswers: Record<string, string> = {
    practice: '```json ' + JSON.stringify(practice) + ' ```',
};
