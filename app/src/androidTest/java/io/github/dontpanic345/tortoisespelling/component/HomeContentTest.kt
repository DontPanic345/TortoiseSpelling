package io.github.dontpanic345.tortoisespelling.component

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import io.github.dontpanic345.tortoisespelling.data.TodayPlan
import io.github.dontpanic345.tortoisespelling.ui.TestTags
import io.github.dontpanic345.tortoisespelling.ui.home.HomeContent
import io.github.dontpanic345.tortoisespelling.ui.home.HomeUiState
import io.github.dontpanic345.tortoisespelling.ui.theme.TortoiseSpellingTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class HomeContentTest {
    @get:Rule
    val compose = createComposeRule()

    private val calls = mutableListOf<String>()

    private fun show(state: HomeUiState) {
        compose.setContent {
            TortoiseSpellingTheme(darkTheme = false) {
                HomeContent(
                    state = state,
                    onStartReview = { calls += "start" },
                    onPracticeMore = { calls += "practice" },
                    onAddWord = { calls += "add" },
                    onOpenWords = { calls += "words" },
                    onOpenSettings = { calls += "settings" },
                )
            }
        }
    }

    private fun withWords(
        due: Int = 0,
        new: Int = 0,
        reviewedToday: Int = 0,
        streak: Int = 0,
        nextDueDay: Long? = null,
    ) = HomeUiState(
        loading = false,
        plan = TodayPlan(due, new),
        totalWords = 5,
        reviewedToday = reviewedToday,
        streak = streak,
        nextDueDay = nextDueDay,
        today = 100,
        greeting = "Good morning",
        dateLabel = "Monday",
    )

    @Test
    fun loadingShowsNoCards() {
        show(HomeUiState())
        compose.onNodeWithText("No words yet").assertDoesNotExist()
        compose.onNodeWithText("Start").assertDoesNotExist()
    }

    @Test
    fun withNoWordsTheFirstRunPanelOffersToAddOne() {
        show(HomeUiState(loading = false))
        compose.onNodeWithText("No words yet").assertExists()
        compose.onNodeWithText("Add your first word").performClick()
        assertEquals(listOf("add"), calls)
    }

    @Test
    fun theAddWordButtonCallsOnAddWord() {
        show(HomeUiState(loading = false))
        compose.onNodeWithTag(TestTags.HOME_ADD_WORD).performClick()
        assertEquals(listOf("add"), calls)
    }

    @Test
    fun dueWordsShowTheCountAndStart() {
        show(withWords(due = 2, new = 1, reviewedToday = 4))
        compose.onNodeWithTag(TestTags.HOME_PRACTICE_COUNT).assertExists()
        compose.onNodeWithText("3").assertExists()
        compose.onNodeWithText("words to practise today").assertExists()
        compose.onNodeWithText("1 of them is new").assertExists()
        compose.onNodeWithText("Reviewed today: 4").assertExists()
        compose.onNodeWithText("Start").performClick()
        assertEquals(listOf("start"), calls)
    }

    @Test
    fun oneWordIsSingular() {
        show(withWords(due = 1))
        compose.onNodeWithText("word to practise today").assertExists()
    }

    @Test
    fun manyNewWordsArePlural() {
        show(withWords(due = 1, new = 2))
        compose.onNodeWithText("2 of them are new").assertExists()
    }

    @Test
    fun allDoneReplacesTheTodayCardWithTheCompletionPanel() {
        show(withWords(reviewedToday = 3, nextDueDay = 101))
        compose.onNodeWithText("Start").assertDoesNotExist()
        compose.onNodeWithText("All done — see you tomorrow").assertExists()
        compose.onNodeWithText("Practise a few more anyway").performClick()
        assertEquals(listOf("practice"), calls)
    }

    @Test
    fun theWeekCardReadsTheStreak() {
        show(withWords(due = 1, streak = 1))
        compose.onNodeWithText("🔥 1 day in a row").assertExists()
    }

    @Test
    fun theWeekCardPluralisesTheStreak() {
        show(withWords(due = 1, streak = 3))
        compose.onNodeWithText("🔥 3 days in a row").assertExists()
    }

    @Test
    fun theMenuOpensSettingsAndAllWords() {
        show(withWords(due = 1))
        compose.onNodeWithContentDescription("More").performClick()
        compose.onNodeWithText("Settings").performClick()
        compose.onNodeWithContentDescription("More").performClick()
        compose.onNodeWithText("All words").performClick()
        assertEquals(listOf("settings", "words"), calls)
    }
}
