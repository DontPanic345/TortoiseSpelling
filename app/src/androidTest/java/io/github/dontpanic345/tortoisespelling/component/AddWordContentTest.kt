package io.github.dontpanic345.tortoisespelling.component

import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import io.github.dontpanic345.tortoisespelling.domain.ContentEdit
import io.github.dontpanic345.tortoisespelling.ui.TestTags
import io.github.dontpanic345.tortoisespelling.ui.add.AddWordContent
import io.github.dontpanic345.tortoisespelling.ui.add.AddWordUiState
import io.github.dontpanic345.tortoisespelling.ui.add.PasteDraft
import io.github.dontpanic345.tortoisespelling.ui.theme.TortoiseSpellingTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class AddWordContentTest {
    @get:Rule
    val compose = createComposeRule()

    private val edits = mutableListOf<ContentEdit>()
    private var saved = 0
    private var copied = 0
    private var opened = 0
    private var used = 0
    private var dismissed = 0
    private val pasted = mutableListOf<String>()
    private val copiedErrors = mutableListOf<String>()

    private fun show(state: AddWordUiState) {
        compose.setContent {
            TortoiseSpellingTheme(darkTheme = false) {
                AddWordContent(
                    state = state,
                    onBack = {},
                    onDelete = {},
                    onTextChange = {},
                    onCopyPrompt = { copied++ },
                    onOpenPaste = { opened++ },
                    onPasteTextChange = { pasted += it },
                    onUsePaste = { used++ },
                    onDismissPaste = { dismissed++ },
                    onCopyPasteError = { copiedErrors += it },
                    onEdit = { edits += it },
                    onSave = { saved++ },
                )
            }
        }
    }

    @Test
    fun aNewWordShowsOneDefinitionAndTheBaseFormWithNothingToRemove() {
        show(Fixtures.addNew())

        compose.onNodeWithText("Definition 1").assertExists()
        compose.onNodeWithText("The word itself").assertExists()
        compose.onAllNodesWithText("Definition 2").assertCountEquals(0)
        compose.onAllNodesWithContentDescription("Remove definition 1").assertCountEquals(0)
        compose.onAllNodesWithContentDescription("Remove form", substring = true).assertCountEquals(0)
        compose.onNodeWithTag(TestTags.addWordFormText(0, 0)).assertDoesNotExist()
    }

    @Test
    fun theBaseFormDropsThePlaceholderOnceThereIsAWord() {
        show(Fixtures.addRun())

        compose.onAllNodesWithText("The word itself").assertCountEquals(0)
    }

    @Test
    fun addFormAndAddDefinitionSendTheirEditsWithTheRightIndices() {
        show(Fixtures.addRunWithTwoDefinitions())

        compose.onNodeWithTag(TestTags.addWordAddForm(1)).performScrollTo().performClick()
        compose.onNodeWithTag(TestTags.ADD_WORD_ADD_DEFINITION).performScrollTo().performClick()
        compose.onNodeWithTag(TestTags.addWordAddExample(0, 1)).performScrollTo().performClick()

        assertEquals(
            listOf(ContentEdit.AddForm(1), ContentEdit.AddDefinition, ContentEdit.AddExample(0, 1)),
            edits,
        )
    }

    @Test
    fun aSecondFormsRemoveButtonSendsRemoveForm() {
        show(Fixtures.addRun())

        compose.onNodeWithContentDescription("Remove form “ran”").performScrollTo().performClick()

        assertEquals(listOf<ContentEdit>(ContentEdit.RemoveForm(0, 1)), edits)
    }

    @Test
    fun aSecondDefinitionCanBeRemoved() {
        show(Fixtures.addRunWithTwoDefinitions())

        compose.onNodeWithContentDescription("Remove definition 2").performScrollTo().performClick()

        assertEquals(listOf<ContentEdit>(ContentEdit.RemoveDefinition(1)), edits)
    }

    @Test
    fun anExampleWithoutItsFormShowsTheWarning() {
        show(Fixtures.addRunWithExampleMissingTheForm())

        compose.onNodeWithText("Doesn't contain “ran”, so review can't blank it.").performScrollTo().assertExists()
    }

    @Test
    fun anExampleWithItsFormShowsNoWarning() {
        show(Fixtures.addRun())

        compose.onAllNodesWithText("Doesn't contain", substring = true).assertCountEquals(0)
    }

    @Test
    fun aTwoWordFormShowsItsWarningAndSaveStaysEnabled() {
        show(Fixtures.addRunWithTwoWordForm())

        compose.onNodeWithText("“most run” is more than one word. Spelling review asks for one word.")
            .performScrollTo().assertExists()
        compose.onNodeWithTag(TestTags.ADD_WORD_SAVE).performScrollTo().assertIsEnabled()
    }

    @Test
    fun aValidAnswerWithATwoWordFormShowsTheWarningInTheDialog() {
        show(Fixtures.addPasteValidWithTwoWordForm())

        compose.onNodeWithText("“most run” is more than one word. Spelling review asks for one word.").assertExists()
        compose.onNodeWithTag(TestTags.ADD_WORD_PASTE_USE).assertIsEnabled()
    }

    @Test
    fun saveIsDisabledWhileTheFirstDefinitionIsBlank() {
        show(Fixtures.addNew().copy(text = "run"))

        compose.onNodeWithTag(TestTags.ADD_WORD_SAVE).performScrollTo().assertIsNotEnabled()
        compose.onNodeWithText("Required").assertExists()
    }

    @Test
    fun saveIsEnabledOnceTheTreeIsComplete() {
        show(Fixtures.addRun())

        compose.onNodeWithTag(TestTags.ADD_WORD_SAVE).performScrollTo().assertIsEnabled().performClick()

        assertEquals(1, saved)
    }

    @Test
    fun copyPromptNeedsAWordAndPasteAnswerDoesNot() {
        show(Fixtures.addNew())

        compose.onNodeWithTag(TestTags.ADD_WORD_COPY_PROMPT).assertIsNotEnabled()
        compose.onNodeWithTag(TestTags.ADD_WORD_PASTE).assertIsEnabled().performClick()

        assertEquals(1, opened)
        assertEquals(0, copied)
        compose.onAllNodesWithText("Look up with Claude").assertCountEquals(0)
    }

    @Test
    fun copyPromptCallsBackOnceThereIsAWord() {
        show(Fixtures.addRun())

        compose.onNodeWithTag(TestTags.ADD_WORD_COPY_PROMPT).assertIsEnabled().performClick()

        assertEquals(1, copied)
    }

    @Test
    fun theDialogIsClosedUntilPasteAnswerIsTapped() {
        show(Fixtures.addNew())

        compose.onAllNodesWithText("Paste the answer").assertCountEquals(0)
    }

    @Test
    fun anInvalidAnswerShowsItsMessageAndCannotBeUsed() {
        show(Fixtures.addPasteInvalid())

        compose.onNodeWithText("That JSON is broken, so Tortoise Spelling can't read it. A bracket or comma may be missing. Ask the chat to fix it, or copy its whole answer again.")
            .assertExists()
        compose.onNodeWithTag(TestTags.ADD_WORD_PASTE_USE).assertIsNotEnabled()
    }

    @Test
    fun copyErrorSendsTheMessageAndSaysItWasCopied() {
        val message = "That JSON is broken, so Tortoise Spelling can't read it. A bracket or comma may be missing. Ask the chat to fix it, or copy its whole answer again."
        show(Fixtures.addPasteInvalid())

        compose.onNodeWithTag(TestTags.ADD_WORD_PASTE_COPY_ERROR).performClick()

        assertEquals(listOf(message), copiedErrors)
        compose.onNodeWithText("Error copied").assertExists()
    }

    @Test
    fun aValidAnswerHasNoCopyError() {
        show(Fixtures.addPasteValid())
        compose.onNodeWithTag(TestTags.ADD_WORD_PASTE_COPY_ERROR).assertDoesNotExist()
    }

    @Test
    fun aValidAnswerShowsItsSummaryAndCanBeUsedOrCancelled() {
        show(Fixtures.addPasteValid())

        compose.onNodeWithText("1 definition, 2 forms, 2 example sentences").assertExists()
        compose.onNodeWithTag(TestTags.ADD_WORD_PASTE_USE).assertIsEnabled().performClick()
        compose.onNodeWithText("Cancel").performClick()

        assertEquals(1, used)
        assertEquals(1, dismissed)
    }

    @Test
    fun theRenameLineShowsOnlyWhenTheAnswerChangesTheWord() {
        show(Fixtures.addPasteValid(typed = "recieve", answer = "receive"))
        compose.onNodeWithText("This answer is for “receive”. Using it changes the word from “recieve”.").assertExists()
    }

    @Test
    fun noRenameLineWhenTheWordMatches() {
        show(Fixtures.addPasteValid())
        compose.onAllNodesWithText("This answer is for", substring = true).assertCountEquals(0)
    }

    @Test
    fun theReplaceLineShowsWhenEditingButNotForABlankNewWord() {
        val replaces = "Using it replaces the definitions, forms and examples on this screen."

        show(Fixtures.addPasteValid().let { it.copy(editingId = 3, text = it.text) })
        compose.onNodeWithText(replaces).assertExists()
    }

    @Test
    fun noReplaceLineForABlankNewWord() {
        show(Fixtures.addPasteValid())
        compose.onAllNodesWithText("Using it replaces", substring = true).assertCountEquals(0)
    }

    @Test
    fun typingInTheAnswerFieldReachesTheCallback() {
        show(Fixtures.addNew().copy(paste = PasteDraft()))

        compose.onNodeWithTag(TestTags.ADD_WORD_PASTE_TEXT).performTextInput("{}")

        assertEquals(listOf("{}"), pasted)
    }
}
