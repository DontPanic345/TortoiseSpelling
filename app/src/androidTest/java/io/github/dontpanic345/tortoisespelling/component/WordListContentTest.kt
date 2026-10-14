package io.github.dontpanic345.tortoisespelling.component

import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import io.github.dontpanic345.tortoisespelling.data.Word
import io.github.dontpanic345.tortoisespelling.data.testWord
import io.github.dontpanic345.tortoisespelling.domain.WordFilter
import io.github.dontpanic345.tortoisespelling.ui.TestTags
import io.github.dontpanic345.tortoisespelling.ui.theme.TortoiseSpellingTheme
import io.github.dontpanic345.tortoisespelling.ui.words.WordListContent
import io.github.dontpanic345.tortoisespelling.ui.words.WordListUiState
import io.github.dontpanic345.tortoisespelling.ui.words.WordRow
import io.github.dontpanic345.tortoisespelling.ui.words.noMatchesBody
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class WordListContentTest {
    @get:Rule
    val compose = createComposeRule()

    private val edited = mutableListOf<Long>()
    private val deleted = mutableListOf<Word>()

    private fun show(state: WordListUiState) {
        compose.setContent {
            TortoiseSpellingTheme(darkTheme = false) {
                WordListContent(
                    state = state,
                    onBack = {},
                    onEdit = { edited += it },
                    onQueryChange = {},
                    onFilterChange = {},
                    onToggleSuspended = {},
                    onDelete = { deleted += it },
                )
            }
        }
    }

    private val words = listOf(
        testWord("rhythm").copy(id = 1),
        testWord("necessary").copy(id = 2),
        testWord("liaison").copy(id = 3),
    )
    private val statuses = listOf("new", "due today", "in 4 days")

    private fun listState() = WordListUiState(
        loading = false,
        filterCounts = WordFilter.entries.associateWith { 3 },
        rows = words.zip(statuses) { w, s -> WordRow(w, s) },
        totalCount = 3,
    )

    @Test
    fun noWordsShowsTheEmptyStateWithoutFilters() {
        show(WordListUiState(loading = false))
        compose.onNodeWithText("No words yet").assertExists()
        compose.onNodeWithTag(TestTags.WORD_FILTER_ROW).assertDoesNotExist()
    }

    @Test
    fun aQueryMatchingNothingSaysSo() {
        show(
            WordListUiState(
                loading = false,
                query = "zzz",
                filterCounts = WordFilter.entries.associateWith { 3 },
                totalCount = 3,
            ),
        )
        compose.onNodeWithText("No matches").assertExists()
        compose.onNodeWithText(noMatchesBody("zzz", WordFilter.ALL)).assertExists()
    }

    @Test
    fun rowsShowTheirStatusAndTheTotal() {
        show(listState())
        compose.onNodeWithText("All words (3)").assertExists()
        words.zip(statuses).forEach { (word, status) ->
            compose.onNodeWithTag(TestTags.wordRowStatus(word.normalizedText), useUnmergedTree = true).assertTextEquals(status)
        }
    }

    @Test
    fun tappingARowEditsIt() {
        show(listState())
        compose.onNodeWithTag(TestTags.wordRow("necessary")).performClick()
        assertEquals(listOf(2L), edited)
    }

    @Test
    fun deleteAsksFirstThenDeletes() {
        show(listState())
        compose.onAllNodesWithContentDescription("Delete word")[0].performClick()
        compose.onNodeWithText("Delete “rhythm”?").assertExists()
        compose.onNodeWithText("Delete").performClick()
        assertEquals(listOf("rhythm"), deleted.map { it.text })
        compose.onNodeWithText("Delete “rhythm”?").assertDoesNotExist()
    }

    @Test
    fun cancelDeletesNothing() {
        show(listState())
        compose.onAllNodesWithContentDescription("Delete word")[0].performClick()
        compose.onNodeWithText("Cancel").performClick()
        assertEquals(emptyList<Word>(), deleted)
        compose.onNodeWithText("Delete “rhythm”?").assertDoesNotExist()
    }
}
