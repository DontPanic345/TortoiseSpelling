/**
 * Mirrors app/src/main/java/io/github/dontpanic345/tortoisespelling/ui/TestTags.kt — change both
 * together. The app exposes each Compose test tag as the node's resource-id, verbatim
 * (no package prefix), so find these with byTestId() rather than Appium's `id=` strategy.
 */
export const testIds = {
    homePracticeCount: 'home_practice_count',
    homeAddWord: 'home_add_word',
    /** The week strip; each day's dot is described as e.g. "Today, practised". */
    homeWeek: 'home_week',
    /** The words card; its progress bar is described as e.g. "0 known, 1 learning, 0 new". */
    homeProgress: 'home_progress',

    addWordText: 'add_word_text',
    addWordDefinition: 'add_word_definition',
    addWordExample: 'add_word_example',
    addWordPartOfSpeech: 'add_word_part_of_speech',
    addWordSave: 'add_word_save',
    addWordLookUp: 'add_word_look_up',

    wordListSearch: 'word_list_search',
    /** The horizontally scrolling row of filter chips. */
    wordFilterRow: 'word_filter_row',
    /** One tag per filter chip, e.g. "word_filter_due". */
    wordFilter: (name: string): string => `word_filter_${name}`,
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
    settingsCloudBackupSwitch: 'settings_cloud_backup_switch',

    reviewAnswer: 'review_answer',
    reviewSubmit: 'review_submit',
    reviewCorrectWord: 'review_correct_word',
} as const;
