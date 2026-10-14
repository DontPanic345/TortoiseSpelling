package io.github.dontpanic345.tortoisespelling.integration

import kotlinx.coroutines.runBlocking
import org.junit.Rule
import org.junit.Test

class StreakJourneyTest {
    @get:Rule
    val app = AppHarness()

    @Test
    fun aQuietDayBridgesTheStreak() {
        runBlocking { app.container.repository.addWord("necessary", "Required.", "It is necessary to sleep.", null) }
        app.launch()

        app.awaitPracticeCount(1)
        app.click("Start")
        app.spell("necessary")
        app.awaitText("All done — see you tomorrow")
        app.click("Done")

        app.nextDay()
        app.awaitPracticeCount(1)
        app.click("Start")
        app.spell("necessary")
        app.awaitText("Next review: in 6 days")
        app.click("Done")

        app.nextDay()
        app.awaitText("All done for today")
        app.awaitText("🔥 2 days in a row")

        app.nextDay()
        app.awaitText("All done for today")
        app.awaitText("🔥 2 days in a row")
    }
}
