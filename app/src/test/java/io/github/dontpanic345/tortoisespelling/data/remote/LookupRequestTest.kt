package io.github.dontpanic345.tortoisespelling.data.remote

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LookupRequestTest {

    @Test
    fun `a plain lookup sends the word alone`() {
        assertEquals("Word: rhythm", lookupRequest("rhythm", stale = null))
    }

    @Test
    fun `a refresh carries the card it is replacing`() {
        val request = lookupRequest(
            "rhythm",
            StaleCard(
                definition = "A repeated pattern of sound.",
                example = "The drummer kept a steady rhythm.",
            ),
        )
        assertTrue(request.startsWith("Word: rhythm"))
        assertTrue(request.contains("Previous definition: A repeated pattern of sound."))
        assertTrue(request.contains("Previous example: The drummer kept a steady rhythm."))
    }

    @Test
    fun `a refresh asks for something genuinely different`() {
        val request = lookupRequest("rhythm", StaleCard("a pattern", "a sentence"))
        assertTrue(request.contains("different example sentence"))
        // The word is already in the list under this spelling, so a refresh must not
        // come back as a correction of it.
        assertTrue(request.contains("spelling of the word itself must not change"))
    }

    @Test
    fun `an empty previous field is left out rather than sent blank`() {
        val request = lookupRequest("rhythm", StaleCard(definition = "a pattern", example = "  "))
        assertTrue(request.contains("Previous definition:"))
        assertFalse(request.contains("Previous example:"))
    }
}
