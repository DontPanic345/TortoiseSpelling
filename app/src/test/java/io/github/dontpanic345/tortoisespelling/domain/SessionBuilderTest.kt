package io.github.dontpanic345.tortoisespelling.domain

import io.github.dontpanic345.tortoisespelling.data.Word
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

class SessionBuilderTest {

    private fun word(id: Long, text: String) =
        Word(id = id, text = text, normalizedText = text, definition = "", example = "", dueOn = 0)

    @Test
    fun `allowance subtracts words introduced today`() {
        assertEquals(7, remainingNewToday(newWordsPerDay = 10, introducedToday = 3))
    }

    @Test
    fun `allowance never goes negative`() {
        assertEquals(0, remainingNewToday(newWordsPerDay = 10, introducedToday = 25))
    }

    @Test
    fun `queue contains every word exactly once`() {
        val due = (1L..8L).map { word(it, "due$it") }
        val fresh = (100L..103L).map { word(it, "new$it") }
        val queue = interleaveSession(due, fresh, Random(1))
        assertEquals(12, queue.size)
        assertEquals(12, queue.map { it.id }.toSet().size)
    }

    @Test
    fun `new words are not all crammed at the end`() {
        val due = (1L..9L).map { word(it, "due$it") }
        val fresh = (100L..102L).map { word(it, "new$it") }
        val queue = interleaveSession(due, fresh, Random(7))
        val positions = queue.withIndex().filter { it.value.id >= 100 }.map { it.index }
        assertTrue("new words should reach the first half, got $positions", positions.first() < 6)
    }

    @Test
    fun `handles a session made only of new words`() {
        val fresh = (1L..5L).map { word(it, "new$it") }
        assertEquals(5, interleaveSession(emptyList(), fresh, Random(3)).size)
    }

    @Test
    fun `handles an empty session`() {
        assertTrue(interleaveSession(emptyList(), emptyList(), Random(3)).isEmpty())
    }
}
