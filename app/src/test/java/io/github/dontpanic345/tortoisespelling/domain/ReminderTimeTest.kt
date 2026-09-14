package io.github.dontpanic345.tortoisespelling.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDateTime

class ReminderTimeTest {

    private val hour = 1000L * 60 * 60

    @Test
    fun `targets later today when the time has not passed`() {
        val now = LocalDateTime.of(2026, 9, 10, 6, 0)
        assertEquals(2 * hour, millisUntilNext(8, 0, now))
    }

    @Test
    fun `rolls to tomorrow once the time has passed`() {
        val now = LocalDateTime.of(2026, 9, 10, 9, 0)
        assertEquals(23 * hour, millisUntilNext(8, 0, now))
    }

    @Test
    fun `exactly on the hour targets tomorrow, never zero`() {
        // A zero delay would let the worker re-fire immediately and loop.
        val now = LocalDateTime.of(2026, 9, 10, 8, 0)
        assertEquals(24 * hour, millisUntilNext(8, 0, now))
    }

    @Test
    fun `is always strictly in the future`() {
        val now = LocalDateTime.of(2026, 9, 10, 13, 37, 42)
        for (h in 0..23) {
            for (m in listOf(0, 15, 30, 45)) {
                assertTrue(millisUntilNext(h, m, now) > 0)
            }
        }
    }

    @Test
    fun `handles a reminder set for just before midnight`() {
        val now = LocalDateTime.of(2026, 9, 10, 23, 30)
        assertEquals(29L * 60 * 1000, millisUntilNext(23, 59, now))
    }
}
