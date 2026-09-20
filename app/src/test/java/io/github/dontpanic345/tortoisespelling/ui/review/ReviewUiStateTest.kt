package io.github.dontpanic345.tortoisespelling.ui.review

import io.github.dontpanic345.tortoisespelling.data.Word
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ReviewUiStateTest {

    private fun word(text: String, example: String = "") = Word(
        id = 1,
        text = text,
        normalizedText = text.lowercase(),
        definition = "a definition",
        example = example,
        dueOn = 0,
    )

    private fun loaded(vararg words: Word, hasApiKey: Boolean = true) =
        ReviewUiState(loading = false, queue = words.toList(), hasApiKey = hasApiKey)

    @Test
    fun `a card can be refreshed once there is a key and a word on screen`() {
        assertTrue(loaded(word("rhythm")).canRefresh)
    }

    @Test
    fun `no key means no refresh`() {
        assertFalse(loaded(word("rhythm"), hasApiKey = false).canRefresh)
    }

    @Test
    fun `a refresh already in flight cannot be started again`() {
        assertFalse(loaded(word("rhythm")).copy(refreshing = true).canRefresh)
    }

    @Test
    fun `there is nothing to refresh before the session has loaded`() {
        assertFalse(ReviewUiState(hasApiKey = true).canRefresh)
    }

    @Test
    fun `there is nothing to refresh past the end of the queue`() {
        assertFalse(loaded(word("rhythm")).copy(index = 1).canRefresh)
    }

    @Test
    fun `the example is blanked when the word appears in it`() {
        val state = loaded(word("rhythm", example = "The drummer kept a steady rhythm."))
        val blanked = state.blankedExample!!
        assertTrue(blanked.didBlank)
        assertEquals("The drummer kept a steady _____.", blanked.text)
    }

    @Test
    fun `an inflected example is reported as not blanked`() {
        // The screen leans on didBlank to decide whether the sentence is safe to show.
        val state = loaded(word("run", example = "She ran the whole race."))
        assertFalse(state.blankedExample!!.didBlank)
    }
}
