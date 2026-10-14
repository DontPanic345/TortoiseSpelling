package io.github.dontpanic345.tortoisespelling.integration

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class SchedulingJourneyTest {
    @get:Rule
    val app = AppHarness()

    @Test
    fun aWordAnsweredCorrectlyTwiceIsDueAgainInSixDays() {
        val day = app.today
        runBlocking { app.container.repository.addWord("necessary", "Required.", "It is necessary to sleep.", null) }
        app.launch()

        app.awaitPracticeCount(1)
        app.click("Start")
        app.spell("necessary")
        app.awaitText("All done — see you tomorrow")
        app.awaitText("Next review: tomorrow")

        val afterFirst = runBlocking { app.dao.allWordsOnce().single() }
        assertEquals(1, afterFirst.repetitions)
        assertEquals(day + 1, afterFirst.dueOn)

        app.click("Done")
        app.nextDay()
        app.awaitPracticeCount(1)
        app.click("Start")
        app.spell("necessary")
        app.awaitText("Next review: in 6 days")

        val afterSecond = runBlocking { app.dao.allWordsOnce().single() }
        assertEquals(day + 1 + 6, afterSecond.dueOn)
        val logs = app.logs()
        assertEquals(2, logs.size)
        assertTrue(logs.all { it.correct })

        app.click("Done")
        app.click("See all")
        app.awaitRowStatus("necessary", "in 6 days")
    }
}
