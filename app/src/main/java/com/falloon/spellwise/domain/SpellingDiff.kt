package com.falloon.spellwise.domain

/**
 * Where a wrong attempt first went off the rails.
 *
 * [firstDivergence] is the index of the first differing character, or the length of
 * the shorter string when one is a prefix of the other. It is -1 when the two match.
 */
data class SpellingDiff(
    val expected: String,
    val actual: String,
    val firstDivergence: Int,
) {
    val matches: Boolean get() = firstDivergence < 0

    /** Characters of the attempt that were still on track. */
    val correctPrefixLength: Int get() = if (matches) actual.length else firstDivergence
}

fun spellingDiff(expected: String, actual: String): SpellingDiff {
    val shared = minOf(expected.length, actual.length)
    var index = 0
    while (index < shared && expected[index].equalsIgnoreCase(actual[index])) {
        index++
    }
    val divergence = when {
        index < shared -> index
        expected.length != actual.length -> shared
        else -> -1
    }
    return SpellingDiff(expected, actual, divergence)
}

private fun Char.equalsIgnoreCase(other: Char): Boolean =
    this == other || lowercaseChar() == other.lowercaseChar()
