package io.github.dontpanic345.tortoisespelling.ui.add

import io.github.dontpanic345.tortoisespelling.domain.ContentEdit
import io.github.dontpanic345.tortoisespelling.domain.FormWarning
import io.github.dontpanic345.tortoisespelling.domain.PastedLookup
import io.github.dontpanic345.tortoisespelling.domain.WordContent
import io.github.dontpanic345.tortoisespelling.domain.apply
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
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

    @Test
    fun `copy prompt follows the word`() {
        assertFalse(AddWordUiState().canCopyPrompt)
        assertFalse(AddWordUiState(text = "  ").canCopyPrompt)
        assertTrue(AddWordUiState(text = "rhythm").canCopyPrompt)
    }

    private fun withForm(word: String, form: String) = AddWordUiState(
        text = word,
        content = WordContent.blank()
            .apply(ContentEdit.DefinitionText(0, "eager to know"))
            .apply(ContentEdit.AddForm(0))
            .apply(ContentEdit.FormText(0, 1, form)),
    )

    @Test
    fun `a two-word form is flagged and fixing its text clears the mark`() {
        val flagged = withForm("curious", "most curious")
        assertEquals(
            listOf(FormWarning(0, 1, "“most curious” is more than one word. Spelling review asks for one word.")),
            flagged.formWarnings,
        )
        val fixed = flagged.copy(content = flagged.content.apply(ContentEdit.FormText(0, 1, "curiouser")))
        assertTrue(fixed.formWarnings.isEmpty())
    }

    @Test
    fun `a valid answer with a two-word form has a warning`() {
        val content = withForm("curious", "most curious").content
        val draft = PasteDraft(text = "{}", result = PastedLookup.Valid("curious", content, renames = false))
        assertEquals(listOf(FormWarning(0, 1, "“most curious” is more than one word. Spelling review asks for one word.")), draft.warnings)
    }

    @Test
    fun `an invalid or missing answer has no warnings`() {
        assertTrue(PasteDraft(text = "x", result = PastedLookup.Invalid("Broken.")).warnings.isEmpty())
        assertTrue(PasteDraft().warnings.isEmpty())
    }

    private val answerContent = WordContent.blank().apply(ContentEdit.DefinitionText(0, "to move fast on foot"))

    private fun answer(word: String, renames: Boolean) = PastedLookup.Valid(word, answerContent, renames)

    @Test
    fun `applying an answer replaces the text and content and closes the dialog`() {
        val before = AddWordUiState(
            text = "run",
            content = WordContent.blank().apply(ContentEdit.DefinitionText(0, "old")),
            paste = PasteDraft(text = "{}", result = answer("run", renames = false)),
        )

        val after = before.applying(answer("run", renames = false))

        assertEquals("run", after.text)
        assertEquals(answerContent, after.content)
        assertNull(after.paste)
        assertNull(after.message)
    }

    @Test
    fun `applying an answer that renames the word says so`() {
        val after = AddWordUiState(text = "recieve").applying(answer("receive", renames = true))

        assertEquals("receive", after.text)
        assertEquals("Corrected spelling to “receive”.", after.message)
    }

    @Test
    fun `applying keeps what the answer does not touch`() {
        val before = AddWordUiState(
            editingId = 7,
            text = "run",
            message = "Added ✓ (3 total)",
            addedThisSession = 2,
            totalWords = 3,
        )

        val after = before.applying(answer("run", renames = false))

        assertEquals(7L, after.editingId)
        assertEquals("Added ✓ (3 total)", after.message)
        assertEquals(2, after.addedThisSession)
        assertEquals(3, after.totalWords)
    }
}
