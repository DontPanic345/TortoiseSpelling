package io.github.dontpanic345.tortoisespelling.domain

import io.github.dontpanic345.tortoisespelling.data.Word
import org.junit.Assert.assertEquals
import org.junit.Test

class ProgressTest {

    private fun word(
        isNew: Boolean = false,
        intervalDays: Int = 0,
        suspended: Boolean = false,
        dueOn: Long = 0,
    ) = Word(
        text = "cat",
        normalizedText = "cat",
        definition = "An animal.",
        example = "",
        dueOn = dueOn,
        isNew = isNew,
        intervalDays = intervalDays,
        suspended = suspended,
    )

    @Test
    fun `words split into new, learning and known`() {
        val progress = wordProgress(
            listOf(
                word(isNew = true),
                word(intervalDays = 1),
                word(intervalDays = 20),
                word(intervalDays = 21),
                word(intervalDays = 200),
            ),
        )
        assertEquals(WordProgress(new = 1, learning = 2, known = 2), progress)
        assertEquals(5, progress.total)
    }

    @Test
    fun `suspended words are left out`() {
        val progress = wordProgress(listOf(word(isNew = true, suspended = true), word(intervalDays = 30, suspended = true)))
        assertEquals(WordProgress(new = 0, learning = 0, known = 0), progress)
    }

    @Test
    fun `the New, Learning and Known filters agree with wordProgress for the same list`() {
        val words = listOf(
            word(isNew = true),
            word(intervalDays = 1),
            word(intervalDays = 20),
            word(intervalDays = 21),
            word(intervalDays = 200),
            word(isNew = true, suspended = true),
            word(intervalDays = 30, suspended = true),
        )
        val progress = wordProgress(words)
        val counts = wordFilterCounts(words, today = 0)
        assertEquals(progress.new, counts.getValue(WordFilter.NEW))
        assertEquals(progress.learning, counts.getValue(WordFilter.LEARNING))
        assertEquals(progress.known, counts.getValue(WordFilter.KNOWN))
    }

    @Test
    fun `the Due filter matches an unsuspended, non-new word due on or before today`() {
        assertEquals(true, WordFilter.DUE.matches(word(dueOn = 100), today = 100))
        assertEquals(true, WordFilter.DUE.matches(word(dueOn = 95), today = 100))
        assertEquals(false, WordFilter.DUE.matches(word(dueOn = 101), today = 100))
        assertEquals(false, WordFilter.DUE.matches(word(isNew = true, dueOn = 100), today = 100))
        assertEquals(false, WordFilter.DUE.matches(word(dueOn = 100, suspended = true), today = 100))
    }

    @Test
    fun `the Suspended filter matches only suspended words, regardless of their other state`() {
        assertEquals(true, WordFilter.SUSPENDED.matches(word(suspended = true), today = 100))
        assertEquals(true, WordFilter.SUSPENDED.matches(word(isNew = true, suspended = true), today = 100))
        assertEquals(false, WordFilter.SUSPENDED.matches(word(), today = 100))
    }

    @Test
    fun `the All filter matches everything`() {
        assertEquals(true, WordFilter.ALL.matches(word(), today = 100))
        assertEquals(true, WordFilter.ALL.matches(word(suspended = true), today = 100))
        assertEquals(true, WordFilter.ALL.matches(word(isNew = true), today = 100))
    }

    @Test
    fun `filter counts are over the whole list and each word counts for exactly one learning stage`() {
        val words = listOf(word(isNew = true), word(intervalDays = 1), word(intervalDays = 21), word(suspended = true))
        val counts = wordFilterCounts(words, today = 0)
        assertEquals(4, counts.getValue(WordFilter.ALL))
        assertEquals(1, counts.getValue(WordFilter.NEW))
        assertEquals(1, counts.getValue(WordFilter.LEARNING))
        assertEquals(1, counts.getValue(WordFilter.KNOWN))
        assertEquals(1, counts.getValue(WordFilter.SUSPENDED))
    }

    @Test
    fun `the strip is the last seven days, oldest first`() {
        val days = recentDays(today = 100, studyDays = emptySet(), satisfiedDays = emptySet(), firstDay = 50)
        assertEquals((94L..100L).toList(), days.map { it.day })
    }

    @Test
    fun `each day is practised, bridged, missed or pending`() {
        val days = recentDays(
            today = 100,
            studyDays = setOf(95, 96, 99),
            satisfiedDays = setOf(97),
            firstDay = 50,
        )
        assertEquals(
            listOf(
                DayMark.MISSED, // 94
                DayMark.PRACTICED, // 95
                DayMark.PRACTICED, // 96
                DayMark.NOTHING_DUE, // 97
                DayMark.MISSED, // 98
                DayMark.PRACTICED, // 99
                DayMark.PENDING, // 100, today
            ),
            days.map { it.mark },
        )
    }

    @Test
    fun `today reads as practised once there has been a review`() {
        val days = recentDays(today = 100, studyDays = setOf(100), satisfiedDays = emptySet(), firstDay = 100)
        assertEquals(DayMark.PRACTICED, days.last().mark)
    }

    @Test
    fun `a new user's first week isn't a row of misses`() {
        val days = recentDays(today = 100, studyDays = emptySet(), satisfiedDays = emptySet(), firstDay = 99)
        assertEquals(
            List(5) { DayMark.BEFORE_START } + DayMark.MISSED + DayMark.PENDING,
            days.map { it.mark },
        )
    }

    @Test
    fun `with no words at all nothing counts as missed`() {
        val days = recentDays(today = 100, studyDays = emptySet(), satisfiedDays = emptySet(), firstDay = null)
        assertEquals(List(6) { DayMark.BEFORE_START } + DayMark.PENDING, days.map { it.mark })
    }

    @Test
    fun `the greeting follows the clock`() {
        assertEquals("Good evening", greeting(4))
        assertEquals("Good morning", greeting(5))
        assertEquals("Good morning", greeting(11))
        assertEquals("Good afternoon", greeting(12))
        assertEquals("Good afternoon", greeting(17))
        assertEquals("Good evening", greeting(18))
        assertEquals("Good evening", greeting(0))
    }
}
