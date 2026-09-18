package io.github.dontpanic345.tortoisespelling.data

import org.junit.Assert.assertEquals
import org.junit.Test

/** Review grades by comparing normalized forms, and duplicates are found the same way. */
class NormalizeWordTest {

    @Test
    fun `casing is ignored`() {
        assertEquals(normalizeWord("necessary"), normalizeWord("NECESSARY"))
    }

    @Test
    fun `surrounding whitespace is ignored`() {
        assertEquals("necessary", normalizeWord("  necessary \n"))
    }

    @Test
    fun `inner whitespace collapses to one space`() {
        assertEquals("ad hoc", normalizeWord("ad \t  hoc"))
    }
}
