package com.falloon.spellwise.domain

import com.falloon.spellwise.data.Grade
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

class SrsTest {

    @Test
    fun `new word answered correctly is due in one day`() {
        val next = Sm2Scheduler.next(NewWordState, Grade.FIRST_TRY)
        assertEquals(1, next.repetitions)
        assertEquals(1, next.intervalDays)
    }

    @Test
    fun `second correct review is due in six days`() {
        var state = Sm2Scheduler.next(NewWordState, Grade.FIRST_TRY)
        state = Sm2Scheduler.next(state, Grade.FIRST_TRY)
        assertEquals(2, state.repetitions)
        assertEquals(6, state.intervalDays)
    }

    @Test
    fun `third correct review multiplies by the ease factor`() {
        var state = NewWordState
        repeat(3) { state = Sm2Scheduler.next(state, Grade.FIRST_TRY) }
        assertEquals(3, state.repetitions)
        // ease has climbed 0.1 per perfect review: 2.5 -> 2.8, and 6 * 2.8 = 16.8
        assertEquals(2.8, state.easeFactor, 1e-9)
        assertEquals(17, state.intervalDays)
    }

    @Test
    fun `ease factor rises by a tenth on a perfect review`() {
        val next = Sm2Scheduler.next(NewWordState, Grade.FIRST_TRY)
        assertEquals(2.6, next.easeFactor, 1e-9)
    }

    @Test
    fun `a miss resets repetitions and schedules for tomorrow`() {
        var state = NewWordState
        repeat(4) { state = Sm2Scheduler.next(state, Grade.FIRST_TRY) }
        assertTrue(state.intervalDays > 6)

        val lapsed = Sm2Scheduler.next(state, Grade.AFTER_RETYPE)
        assertEquals(0, lapsed.repetitions)
        assertEquals(1, lapsed.intervalDays)
    }

    @Test
    fun `correct after retype takes the lapse branch`() {
        // The handoff's original mapping used 3, which does NOT reset (3 < 3 is false).
        assertTrue("AFTER_RETYPE must be below the SM-2 reset threshold", Grade.AFTER_RETYPE < 3)
        val lapsed = Sm2Scheduler.next(SrsState(5, 2.5, 40), Grade.AFTER_RETYPE)
        assertEquals(1, lapsed.intervalDays)
    }

    @Test
    fun `a miss lowers the ease factor`() {
        val lapsed = Sm2Scheduler.next(NewWordState, Grade.AFTER_RETYPE)
        assertEquals(2.18, lapsed.easeFactor, 1e-9)
    }

    @Test
    fun `ease factor never drops below one point three`() {
        var state = NewWordState
        repeat(20) { state = Sm2Scheduler.next(state, Grade.GAVE_UP) }
        assertEquals(1.3, state.easeFactor, 1e-9)
    }

    @Test
    fun `intervals are capped`() {
        var state = SrsState(repetitions = 10, easeFactor = 2.5, intervalDays = 300)
        state = Sm2Scheduler.next(state, Grade.FIRST_TRY)
        assertEquals(MAX_INTERVAL_DAYS, state.intervalDays)
    }

    @Test
    fun `short intervals are not fuzzed`() {
        repeat(50) {
            assertEquals(101L, fuzzedDueDay(today = 100, intervalDays = 1, random = Random(it)))
        }
    }

    @Test
    fun `long intervals are fuzzed but stay close`() {
        val results = (0 until 200).map { fuzzedDueDay(1000, 100, Random(it)) }
        assertTrue("fuzz should vary", results.toSet().size > 1)
        assertTrue(results.all { it in 1095L..1105L })
    }

    @Test
    fun `fuzz never schedules a word in the past`() {
        repeat(200) {
            assertTrue(fuzzedDueDay(500, 3, Random(it)) > 500)
        }
    }
}
