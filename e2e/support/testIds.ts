/**
 * Mirrors app/src/main/java/com/falloon/tortoisespelling/ui/TestTags.kt — change both
 * together. The app exposes each Compose test tag as the node's resource-id, verbatim
 * (no package prefix), so find these with byTestId() rather than Appium's `id=` strategy.
 */
export const testIds = {
    homePracticeCount: 'home_practice_count',
    homeAddWord: 'home_add_word',

    addWordText: 'add_word_text',
    addWordDefinition: 'add_word_definition',
    addWordExample: 'add_word_example',
    addWordPartOfSpeech: 'add_word_part_of_speech',
    addWordSave: 'add_word_save',
    addWordLookUp: 'add_word_look_up',

    wordListSearch: 'word_list_search',
    /** Scopes a row's per-row icons (identical content-descs on every row). */
    wordRow: (normalizedText: string): string => `word_row_${normalizedText}`,
    /** The status chip's label, tagged because two rows can share the same status text. */
    wordRowStatus: (normalizedText: string): string => `word_row_status_${normalizedText}`,

    settingsApiKey: 'settings_api_key',
    settingsNewWordsValue: 'settings_new_words_value',
    settingsNewWordsDecrease: 'settings_new_words_decrease',
    settingsNewWordsIncrease: 'settings_new_words_increase',
    settingsReminderSwitch: 'settings_reminder_switch',
    settingsReminderTimeButton: 'settings_reminder_time_button',

    reviewAnswer: 'review_answer',
    reviewSubmit: 'review_submit',
} as const;
