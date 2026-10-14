package io.github.dontpanic345.tortoisespelling.integration

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class PracticeJourneyTest {
    @get:Rule
    val app = AppHarness()

    @Test
    fun extraPracticeLeavesTheScheduleAlone() {
        runBlocking { app.container.repository.addWord("necessary", "Required.", "It is necessary to sleep.", null) }
        app.launch()

        app.awaitPracticeCount(1)
        app.click("Start")
        app.spell("necessary")
        app.awaitText("All done — see you tomorrow")
        val before = runBlocking { app.dao.allWordsOnce() }
        val logsBefore = app.logs()

        app.click("Practise a few more anyway")
        app.awaitText("Extra practice")
        app.spell("necessary")
        app.awaitText("You practised 1 word today.")

        assertEquals(before, runBlocking { app.dao.allWordsOnce() })
        assertEquals(logsBefore, app.logs())
    }
}
