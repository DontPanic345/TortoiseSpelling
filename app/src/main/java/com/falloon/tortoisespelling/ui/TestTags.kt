package com.falloon.tortoisespelling.ui

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

    const val ADD_WORD_TEXT = "add_word_text"
    const val ADD_WORD_DEFINITION = "add_word_definition"
    const val ADD_WORD_EXAMPLE = "add_word_example"
    const val ADD_WORD_PART_OF_SPEECH = "add_word_part_of_speech"
    const val ADD_WORD_SAVE = "add_word_save"
    const val ADD_WORD_LOOK_UP = "add_word_look_up"
}
