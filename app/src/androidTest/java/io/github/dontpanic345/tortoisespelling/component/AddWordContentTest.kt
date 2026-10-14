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
import io.github.dontpanic345.tortoisespelling.domain.ContentEdit
import io.github.dontpanic345.tortoisespelling.ui.TestTags
import io.github.dontpanic345.tortoisespelling.ui.add.AddWordContent
import io.github.dontpanic345.tortoisespelling.ui.add.AddWordUiState
import io.github.dontpanic345.tortoisespelling.ui.theme.TortoiseSpellingTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class AddWordContentTest {
    @get:Rule
    val compose = createComposeRule()

    private val edits = mutableListOf<ContentEdit>()
    private var saved = 0

    private fun show(state: AddWordUiState) {
        compose.setContent {
            TortoiseSpellingTheme(darkTheme = false) {
                AddWordContent(
                    state = state,
                    onBack = {},
                    onDelete = {},
                    onTextChange = {},
                    onLookUp = {},
                    onEdit = { edits += it },
                    onAutoRefreshChange = {},
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
}
