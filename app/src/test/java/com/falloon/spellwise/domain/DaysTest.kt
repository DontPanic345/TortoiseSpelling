package com.falloon.spellwise.domain

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
    fun `stale streak from long ago does not count`() {
        assertEquals(0, Days.currentStreak(setOf(50L, 51L), today = 100))
    }
}
