package io.github.dontpanic345.tortoisespelling.domain

import io.github.dontpanic345.tortoisespelling.data.Grade
import io.github.dontpanic345.tortoisespelling.data.Word
import org.junit.Assert.assertEquals
import org.junit.Test

// The rule's cases are in golden/review.json; these cover the two parameters golden can't.
class ReviewTest {
    private val word = Word(text = "cat", normalizedText = "cat", createdAt = 0, dueOn = 0)

    @Test
    fun `the scheduler passed in decides the next state`() {
        val fixed = SrsState(repetitions = 9, easeFactor = 1.7, intervalDays = 42)
        val asked = mutableListOf<Pair<SrsState, Int>>()
        val scheduler = object : Scheduler {
            override fun next(prev: SrsState, quality: Int): SrsState {
                asked += prev to quality
                return fixed
            }
        }

        val result = reviewed(word, true, "cat", today = 100, now = 5, fuzz = { t, i -> t + i }, scheduler = scheduler)

        assertEquals(listOf(SrsState(0, 2.5, 0) to Grade.FIRST_TRY), asked)
        assertEquals(fixed, SrsState(result.word.repetitions, result.word.easeFactor, result.word.intervalDays))
        assertEquals(142L, result.word.dueOn)
    }

    @Test
    fun `fuzz gets today and the new interval`() {
        val calls = mutableListOf<Pair<Long, Int>>()
        val learnt = word.copy(repetitions = 2, easeFactor = 2.7, intervalDays = 6, isNew = false)

        val result = reviewed(learnt, true, "cat", today = 100, now = 5, fuzz = { t, i -> calls += t to i; 123 })

        assertEquals(listOf(100L to 17), calls)
        assertEquals(123L, result.word.dueOn)
    }
}
