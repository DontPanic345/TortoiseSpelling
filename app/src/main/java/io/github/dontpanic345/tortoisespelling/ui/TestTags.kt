package io.github.dontpanic345.tortoisespelling.ui

/**
 * Compose test tags for elements the e2e suite cannot find by visible text alone — a
 * text field whose label disappears once it has a value, "Add word", which is a title,
 * a button and a floating action button at once, or a button whose enabled state
 * matters (UiAutomator reports a button's label as a child that is always enabled).
 *
 * MainActivity sets testTagsAsResourceId, so each tag reaches UiAutomator (and Appium)
 * as the node's resource-id, verbatim. Mirrored in e2e/support/testIds.ts: change both
 * together. Prefer visible text in tests where it is unique; add a tag only when not.
 */
object TestTags {
    const val HOME_PRACTICE_COUNT = "home_practice_count"
    const val HOME_ADD_WORD = "home_add_word"
    const val HOME_WEEK = "home_week"
    const val HOME_PROGRESS = "home_progress"

    const val ADD_WORD_TEXT = "add_word_text"
    const val ADD_WORD_DEFINITION = "add_word_definition"
    const val ADD_WORD_EXAMPLE = "add_word_example"
    const val ADD_WORD_PART_OF_SPEECH = "add_word_part_of_speech"
    const val ADD_WORD_SAVE = "add_word_save"
    const val ADD_WORD_COPY_PROMPT = "add_word_copy_prompt"
    const val ADD_WORD_PASTE = "add_word_paste"
    const val ADD_WORD_PASTE_TEXT = "add_word_paste_text"
    const val ADD_WORD_PASTE_USE = "add_word_paste_use"
    const val ADD_WORD_ADD_DEFINITION = "add_word_add_definition"

    /**
     * The tree editor's fields by position (definition, form, example). The first
     * definition, its part of speech and the base form's first example keep the plain
     * tags above.
     */
    fun addWordDefinition(d: Int) = "add_word_definition_$d"
    fun addWordAddForm(d: Int) = "add_word_add_form_$d"
    fun addWordFormText(d: Int, f: Int) = "add_word_form_text_${d}_$f"
    fun addWordFormLabel(d: Int, f: Int) = "add_word_form_label_${d}_$f"
    fun addWordAddExample(d: Int, f: Int) = "add_word_add_example_${d}_$f"
    fun addWordExample(d: Int, f: Int, e: Int) = "add_word_example_${d}_${f}_$e"

    const val WORD_LIST_SEARCH = "word_list_search"

    /** The horizontally scrolling row of filter chips, so e2e can scroll it into view. */
    const val WORD_FILTER_ROW = "word_filter_row"

    /** One tag per filter chip, e.g. "word_filter_due". */
    fun wordFilter(name: String) = "word_filter_$name"

    /** Scopes a row's per-row icons (identical content-descs on every row). */
    fun wordRow(normalizedText: String) = "word_row_$normalizedText"

    /** The status chip's label, tagged because two rows can share the same status text. */
    fun wordRowStatus(normalizedText: String) = "word_row_status_$normalizedText"

    const val SETTINGS_API_KEY = "settings_api_key"
    const val SETTINGS_NEW_WORDS_VALUE = "settings_new_words_value"
    const val SETTINGS_NEW_WORDS_DECREASE = "settings_new_words_decrease"
    const val SETTINGS_NEW_WORDS_INCREASE = "settings_new_words_increase"
    const val SETTINGS_REMINDER_SWITCH = "settings_reminder_switch"
    const val SETTINGS_REMINDER_TIME_BUTTON = "settings_reminder_time_button"
    const val SETTINGS_CLOUD_BACKUP_SWITCH = "settings_cloud_backup_switch"

    const val REVIEW_ANSWER = "review_answer"
    const val REVIEW_SUBMIT = "review_submit"
    const val REVIEW_CORRECT_WORD = "review_correct_word"
}
