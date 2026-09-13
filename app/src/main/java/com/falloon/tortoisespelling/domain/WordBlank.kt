package com.falloon.tortoisespelling.domain

/** Result of hiding a target word inside a longer piece of text. */
data class BlankedText(val text: String, val didBlank: Boolean)

/**
 * The visual placeholder for a blanked word.
 *
 * Fixed regardless of the word's length — sizing it to match would tell the user
 * how many letters to guess.
 */
const val BLANK_PLACEHOLDER: String = "_____"

/**
 * Regex matching [word] only as a whole word.
 *
 * Plain substring matching is not good enough: blanking "ate" in "They ate a plate"
 * would gut "plate" too. Letter/digit lookarounds are used rather than `\b` so that
 * hyphens and apostrophes at the edges still count as boundaries.
 */
private fun wholeWordRegex(word: String): Regex =
    Regex(
        """(?<![\p{L}\p{N}])""" + Regex.escape(word) + """(?![\p{L}\p{N}])""",
        RegexOption.IGNORE_CASE,
    )

/**
 * Replace every whole-word occurrence of [word] in [sentence] with blanks.
 *
 * [BlankedText.didBlank] is false when the word does not appear — Claude is asked
 * for a sentence containing the exact form, but it sometimes returns an inflection.
 * The caller falls back to showing standalone blanks in that case.
 */
fun blankWordIn(sentence: String, word: String): BlankedText {
    if (sentence.isBlank() || word.isBlank()) {
        return BlankedText(sentence, didBlank = false)
    }
    var matched = false
    val replaced = wholeWordRegex(word).replace(sentence) {
        matched = true
        BLANK_PLACEHOLDER
    }
    return BlankedText(replaced, didBlank = matched)
}

/**
 * Defensive scrub of the definition. Claude is instructed not to include the target
 * word in its gloss, but a definition that gives the answer away silently breaks the
 * whole exercise, so it is cheap to enforce here too.
 */
fun hideWordInDefinition(definition: String, word: String): String =
    blankWordIn(definition, word).text
