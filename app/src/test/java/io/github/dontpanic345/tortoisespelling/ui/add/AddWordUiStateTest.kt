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

    @Test
    fun `a second definition with content but no text blocks saving`() {
        val content = WordContent.blank()
            .apply(ContentEdit.DefinitionText(0, "a pattern of sound"))
            .apply(ContentEdit.AddDefinition)
            .apply(ContentEdit.ExampleText(1, 0, 0, "A sentence."))
        assertFalse(AddWordUiState(text = "rhythm", content = content).canSave)
    }

    @Test
    fun `an empty second definition does not block saving`() {
        val content = WordContent.blank()
            .apply(ContentEdit.DefinitionText(0, "a pattern of sound"))
            .apply(ContentEdit.AddDefinition)
        assertTrue(AddWordUiState(text = "rhythm", content = content).canSave)
    }

    @Test
    fun `a form without text blocks saving until it has some`() {
        val withBlankForm = WordContent.blank()
            .apply(ContentEdit.DefinitionText(0, "to move fast on foot"))
            .apply(ContentEdit.AddForm(0))
            .apply(ContentEdit.ExampleText(0, 1, 0, "He ran home."))
        assertFalse(AddWordUiState(text = "run", content = withBlankForm).canSave)
        assertTrue(AddWordUiState(text = "run", content = withBlankForm.apply(ContentEdit.FormText(0, 1, "ran"))).canSave)
    }
}
