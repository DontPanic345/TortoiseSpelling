package io.github.dontpanic345.tortoisespelling.component

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import io.github.dontpanic345.tortoisespelling.ui.complete.CompletionPanel
import io.github.dontpanic345.tortoisespelling.ui.theme.TortoiseSpellingTheme
import org.junit.Rule
import org.junit.Test

class CompletionPanelTest {
    @get:Rule
    val compose = createComposeRule()

    private fun show(reviewed: Int = 0, streak: Int = 0, next: Long? = null) {
        compose.setContent {
            TortoiseSpellingTheme(darkTheme = false) {
                CompletionPanel(reviewedCount = reviewed, streak = streak, nextDueDay = next, today = 100)
            }
        }
    }

    @Test
    fun oneWordIsSingular() {
        show(reviewed = 1)
        compose.onNodeWithText("You practised 1 word today.").assertExists()
    }

    @Test
    fun manyWordsArePlural() {
        show(reviewed = 3)
        compose.onNodeWithText("You practised 3 words today.").assertExists()
    }

    @Test
    fun nothingDueSaysSo() {
        show()
        compose.onNodeWithText("Nothing was due today.").assertExists()
    }

    @Test
    fun noStreakLineAtZero() {
        show(streak = 0)
        compose.onNodeWithText("day streak", substring = true).assertDoesNotExist()
    }

    @Test
    fun streakLineShowsWhenThereIsOne() {
        show(streak = 4)
        compose.onNodeWithText("🔥 4 day streak").assertExists()
    }

    @Test
    fun seeYouTomorrowOnlyWhenSomethingIsDueTomorrow() {
        show(next = 101)
        compose.onNodeWithText("All done — see you tomorrow").assertExists()
    }

    @Test
    fun otherwiseAllDoneForToday() {
        show(next = 105)
        compose.onNodeWithText("All done for today").assertExists()
        compose.onNodeWithText("Next review: in 5 days").assertExists()
    }

    @Test
    fun nothingScheduledYet() {
        show(next = null)
        compose.onNodeWithText("Next review: nothing scheduled yet").assertExists()
    }
}
