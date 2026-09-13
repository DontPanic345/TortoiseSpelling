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
} as const;
