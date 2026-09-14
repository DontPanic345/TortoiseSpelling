package io.github.dontpanic345.tortoisespelling.domain

import org.junit.Assert.assertEquals
import org.junit.Test

class DaysTest {

    @Test
    fun `relative labels read naturally`() {
        assertEquals("today", Days.relativeLabel(100, today = 100))
        assertEquals("tomorrow", Days.relativeLabel(101, today = 100))
        assertEquals("in 5 days", Days.relativeLabel(105, today = 100))
        assertEquals("yesterday", Days.relativeLabel(99, today = 100))
    }

    @Test
    fun `no reviews means no streak`() {
        assertEquals(0, Days.currentStreak(emptySet(), today = 100))
    }

    @Test
    fun `consecutive days ending today count`() {
        assertEquals(3, Days.currentStreak(setOf(98L, 99L, 100L), today = 100))
    }

    @Test
    fun `a streak ending yesterday still stands`() {
        // Today is not over yet, so it should not break the run.
        assertEquals(2, Days.currentStreak(setOf(98L, 99L), today = 100))
    }

    @Test
    fun `a two day gap breaks the streak`() {
        assertEquals(1, Days.currentStreak(setOf(97L, 100L), today = 100))
    }

    @Test
    fun `a day with nothing due bridges the streak`() {
        // The app told the user there was nothing to do; that must not cost them.
        assertEquals(
            2,
            Days.currentStreak(
                studyDays = setOf(98L, 100L),
                today = 100,
                satisfiedDays = setOf(99L),
            ),
        )
    }

    @Test
    fun `a quiet yesterday does not zero the streak before today's session`() {
        assertEquals(
            1,
            Days.currentStreak(
                studyDays = setOf(98L),
                today = 100,
                satisfiedDays = setOf(99L),
            ),
        )
    }

    @Test
    fun `a run of quiet days keeps the streak`() {
        // Long intervals leave whole stretches with nothing due, today included.
        assertEquals(
            2,
            Days.currentStreak(
                studyDays = setOf(94L, 95L),
                today = 100,
                satisfiedDays = setOf(96L, 97L, 98L, 99L, 100L),
            ),
        )
    }

    @Test
    fun `quiet days after a real gap do not revive an old streak`() {
        assertEquals(
            0,
            Days.currentStreak(
                studyDays = setOf(90L),
                today = 100,
                satisfiedDays = setOf(98L, 99L),
            ),
        )
    }

    @Test
    fun `stale streak from long ago does not count`() {
        assertEquals(0, Days.currentStreak(setOf(50L, 51L), today = 100))
    }
}
