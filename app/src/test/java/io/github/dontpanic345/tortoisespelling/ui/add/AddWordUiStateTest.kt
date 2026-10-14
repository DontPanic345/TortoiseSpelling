package io.github.dontpanic345.tortoisespelling.ui.add

import io.github.dontpanic345.tortoisespelling.domain.ContentEdit
import io.github.dontpanic345.tortoisespelling.domain.WordContent
import io.github.dontpanic345.tortoisespelling.domain.apply
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AddWordUiStateTest {

    private fun state(text: String, definition: String) = AddWordUiState(
        text = text,
        content = WordContent.blank().apply(ContentEdit.DefinitionText(0, definition)),
    )

    @Test
    fun `a word and a definition can be saved`() {
        assertTrue(state("rhythm", "a pattern of sound").canSave)
    }

    @Test
    fun `a word without a definition cannot be saved`() {
        assertFalse(state("rhythm", "  ").canSave)
    }

    @Test
    fun `a definition without a word cannot be saved`() {
        assertFalse(state("", "a pattern of sound").canSave)
    }
}
