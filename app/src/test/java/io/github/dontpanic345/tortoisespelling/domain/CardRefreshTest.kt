package io.github.dontpanic345.tortoisespelling.domain

import io.github.dontpanic345.tortoisespelling.data.Word
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CardRefreshTest {

    private val today = 20_400L

    private fun word(
        text: String,
        autoRefresh: Boolean = true,
        refreshedOn: Long? = null,
    ) = Word(
        text = text,
        normalizedText = text,
        definition = "a definition",
        example = "an example",
        dueOn = today,
        autoRefresh = autoRefresh,
        refreshedOn = refreshedOn,
    )

    @Test
    fun `a flagged word that has never been refreshed is due one`() {
        val due = cardsNeedingRefresh(listOf(word("rhythm")), today)
        assertEquals(listOf("rhythm"), due.map { it.text })
    }

    @Test
    fun `an unflagged word is left alone`() {
        assertTrue(cardsNeedingRefresh(listOf(word("rhythm", autoRefresh = false)), today).isEmpty())
    }

    @Test
    fun `a word already refreshed today is not refreshed again`() {
        val words = listOf(word("rhythm", refreshedOn = today))
        assertTrue(cardsNeedingRefresh(words, today).isEmpty())
    }

    @Test
    fun `yesterday's refresh does not count against today`() {
        val words = listOf(word("rhythm", refreshedOn = today - 1))
        assertEquals(1, cardsNeedingRefresh(words, today).size)
    }

    @Test
    fun `a refresh dated in the future does not lock the word out`() {
        // A phone whose clock was wound forward and back again.
        val words = listOf(word("rhythm", refreshedOn = today + 3))
        assertEquals(1, cardsNeedingRefresh(words, today).size)
    }

    @Test
    fun `only the flagged words in a mixed session are picked`() {
        val words = listOf(
            word("rhythm"),
            word("necessary", autoRefresh = false),
            word("accommodate", refreshedOn = today),
            word("occurrence", refreshedOn = today - 9),
        )
        assertEquals(listOf("rhythm", "occurrence"), cardsNeedingRefresh(words, today).map { it.text })
    }
}
