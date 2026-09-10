package com.falloon.spellwise.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SpellingDiffTest {

    @Test
    fun `identical strings do not diverge`() {
        assertTrue(spellingDiff("receive", "receive").matches)
    }

    @Test
    fun `casing alone is not a divergence`() {
        assertTrue(spellingDiff("Paris", "paris").matches)
    }

    @Test
    fun `reports the first differing character`() {
        // rec-ie-ve vs rec-ei-ve: index 3 is the first difference.
        val diff = spellingDiff("receive", "recieve")
        assertFalse(diff.matches)
        assertEquals(3, diff.firstDivergence)
        assertEquals(3, diff.correctPrefixLength)
    }

    @Test
    fun `a truncated attempt diverges at its end`() {
        val diff = spellingDiff("accommodate", "accomm")
        assertEquals(6, diff.firstDivergence)
    }

    @Test
    fun `an overlong attempt diverges at the end of the target`() {
        val diff = spellingDiff("cat", "cats")
        assertEquals(3, diff.firstDivergence)
    }

    @Test
    fun `an empty attempt diverges immediately`() {
        assertEquals(0, spellingDiff("cat", "").firstDivergence)
    }
}
