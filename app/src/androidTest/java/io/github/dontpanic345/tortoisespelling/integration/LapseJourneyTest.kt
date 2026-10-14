package io.github.dontpanic345.tortoisespelling.integration

import io.github.dontpanic345.tortoisespelling.data.testWord
import kotlinx.coroutines.runBlocking
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.performClick
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class LapseJourneyTest {
    @get:Rule
    val app = AppHarness()

    @Test
    fun aMissComesBackTomorrowEvenWhenTheSessionIsAbandoned() {
        val day = app.today
        runBlocking {
            app.dao.insertWord(
                testWord(
                    "necessary",
                    isNew = false,
                    repetitions = 2,
                    intervalDays = 6,
                    dueOn = day,
                    firstReviewedOn = day - 7,
                ),
            )
        }
        app.launch()

        app.awaitPracticeCount(1)
        app.click("Start")
        app.spell("neccesary")
        app.awaitText("Not quite")
        app.compose.onNodeWithContentDescription("End session").performClick()

        app.awaitText("You practised 1 word today.")
        val word = runBlocking { app.dao.allWordsOnce().single() }
        assertEquals(0, word.repetitions)
        assertEquals(1, word.lapses)
        assertEquals(day + 1, word.dueOn)
        val logs = app.logs()
        assertEquals(listOf(LogRow(correct = false, typedAnswer = "neccesary")), logs)

        app.nextDay()
        app.awaitPracticeCount(1)
    }
}
