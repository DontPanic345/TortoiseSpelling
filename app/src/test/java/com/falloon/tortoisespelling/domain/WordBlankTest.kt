package com.falloon.tortoisespelling.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WordBlankTest {

    @Test
    fun `blanks match the word length`() {
        assertEquals("_ _ _", blanksFor(3))
        assertEquals("_", blanksFor(1))
    }

    @Test
    fun `word is replaced in the sentence`() {
        val result = blankWordIn("Please accommodate my request.", "accommodate")
        assertTrue(result.didBlank)
        assertEquals("Please ${blanksFor(11)} my request.", result.text)
    }

    @Test
    fun `matching ignores case`() {
        val result = blankWordIn("Accommodate them.", "accommodate")
        assertTrue(result.didBlank)
        assertEquals("${blanksFor(11)} them.", result.text)
    }

    @Test
    fun `substrings of longer words are left alone`() {
        // The bug this guards: naive replace also guts "plate".
        val result = blankWordIn("They ate a plate of dates.", "ate")
        assertTrue(result.didBlank)
        assertEquals("They ${blanksFor(3)} a plate of dates.", result.text)
    }

    @Test
    fun `word touching punctuation still matches`() {
        val result = blankWordIn("Can you spell \"receive\"?", "receive")
        assertTrue(result.didBlank)
        assertTrue(result.text.contains(blanksFor(7)))
    }

    @Test
    fun `hyphen counts as a boundary`() {
        val result = blankWordIn("A well-groomed dog.", "groomed")
        assertTrue(result.didBlank)
        assertEquals("A well-${blanksFor(7)} dog.", result.text)
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
        assertEquals(2, Regex(Regex.escape(blanksFor(4))).findAll(result.text).count())
    }

    @Test
    fun `regex metacharacters in the word are literal`() {
        val result = blankWordIn("Use a c++ compiler.", "c++")
        assertEquals("Use a ${blanksFor(3)} compiler.", result.text)
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
