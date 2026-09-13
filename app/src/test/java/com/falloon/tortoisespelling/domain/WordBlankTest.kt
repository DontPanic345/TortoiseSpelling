package com.falloon.tortoisespelling.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WordBlankTest {

    @Test
    fun `placeholder is the same regardless of word length`() {
        // The blank must not hint at how many letters the word has.
        val short = blankWordIn("Bury it.", "bury")
        val long = blankWordIn("Please accommodate my request.", "accommodate")
        assertEquals("$BLANK_PLACEHOLDER it.", short.text)
        assertEquals("Please $BLANK_PLACEHOLDER my request.", long.text)
    }

    @Test
    fun `word is replaced in the sentence`() {
        val result = blankWordIn("Please accommodate my request.", "accommodate")
        assertTrue(result.didBlank)
        assertEquals("Please $BLANK_PLACEHOLDER my request.", result.text)
    }

    @Test
    fun `matching ignores case`() {
        val result = blankWordIn("Accommodate them.", "accommodate")
        assertTrue(result.didBlank)
        assertEquals("$BLANK_PLACEHOLDER them.", result.text)
    }

    @Test
    fun `substrings of longer words are left alone`() {
        // The bug this guards: naive replace also guts "plate".
        val result = blankWordIn("They ate a plate of dates.", "ate")
        assertTrue(result.didBlank)
        assertEquals("They $BLANK_PLACEHOLDER a plate of dates.", result.text)
    }

    @Test
    fun `word touching punctuation still matches`() {
        val result = blankWordIn("Can you spell \"receive\"?", "receive")
        assertTrue(result.didBlank)
        assertTrue(result.text.contains(BLANK_PLACEHOLDER))
    }

    @Test
    fun `hyphen counts as a boundary`() {
        val result = blankWordIn("A well-groomed dog.", "groomed")
        assertTrue(result.didBlank)
        assertEquals("A well-$BLANK_PLACEHOLDER dog.", result.text)
    }

    @Test
    fun `missing word reports that nothing was blanked`() {
        val result = blankWordIn("The dogs were accommodating.", "accommodate")
        assertFalse(result.didBlank)
        assertEquals("The dogs were accommodating.", result.text)
    }

    @Test
    fun `every occurrence is blanked`() {
        val result = blankWordIn("Bury it, then bury it again.", "bury")
        assertEquals(2, Regex(Regex.escape(BLANK_PLACEHOLDER)).findAll(result.text).count())
    }

    @Test
    fun `regex metacharacters in the word are literal`() {
        val result = blankWordIn("Use a c++ compiler.", "c++")
        assertEquals("Use a $BLANK_PLACEHOLDER compiler.", result.text)
    }

    @Test
    fun `empty sentence is left alone`() {
        val result = blankWordIn("", "word")
        assertFalse(result.didBlank)
        assertEquals("", result.text)
    }

    @Test
    fun `definition giving the answer away is scrubbed`() {
        val scrubbed = hideWordInDefinition("To accommodate someone is to help them.", "accommodate")
        assertFalse(scrubbed.contains("accommodate"))
    }
}
