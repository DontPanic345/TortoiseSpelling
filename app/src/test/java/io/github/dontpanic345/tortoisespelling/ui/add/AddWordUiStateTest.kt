package io.github.dontpanic345.tortoisespelling.ui.add

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AddWordUiStateTest {

    @Test
    fun `a word and a definition can be saved`() {
        assertTrue(AddWordUiState(text = "rhythm", definition = "a pattern of sound").canSave)
    }

    @Test
    fun `a word without a definition cannot be saved`() {
        assertFalse(AddWordUiState(text = "rhythm", definition = "  ").canSave)
    }

    @Test
    fun `a definition without a word cannot be saved`() {
        assertFalse(AddWordUiState(text = "", definition = "a pattern of sound").canSave)
    }
}
