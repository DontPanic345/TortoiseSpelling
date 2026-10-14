package io.github.dontpanic345.tortoisespelling.integration

import androidx.compose.ui.test.onAllNodesWithText
import kotlinx.coroutines.runBlocking
import org.junit.Rule
import org.junit.Test

class AllowanceJourneyTest {
    private fun shown(word: String) =
        app.compose.onAllNodesWithText(definitionOf(word)).fetchSemanticsNodes().isNotEmpty()

    // Must not contain the word: saving a word scrubs it out of its definition.
    private fun definitionOf(word: String) = "Meaning number ${word.length} of the list."

    /** Which new words come first isn't the test's business, so find it by its definition. */
    private fun spellWhicheverIsShown(words: List<String>) {
        app.compose.waitUntil(timeoutMillis = AppHarness.WAIT_MILLIS) { words.any(::shown) }
        val word = words.first(::shown)
        app.spell(word)
        app.compose.waitUntil(timeoutMillis = AppHarness.WAIT_MILLIS) { !shown(word) }
    }

    @get:Rule
    val app = AppHarness()

    @Test
    fun newWordsAreIntroducedAFewADay() {
        app.container.settings.setNewWordsPerDay(2)
        val words = listOf("necessary", "separate", "definitely")
        runBlocking {
            words.forEach {
                app.container.repository.addWord(it, definitionOf(it), "Use $it here.", null)
            }
        }
        app.launch()

        app.awaitPracticeCount(2)
        app.awaitText("2 of them are new")
        app.click("Start")
        repeat(2) { spellWhicheverIsShown(words) }

        app.awaitText("You practised 2 words today.")
        app.click("Done")
        app.nextDay()
        app.awaitPracticeCount(3)
        app.awaitText("1 of them is new")
    }
}
