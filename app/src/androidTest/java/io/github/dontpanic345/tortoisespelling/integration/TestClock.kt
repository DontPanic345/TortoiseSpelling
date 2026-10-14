package io.github.dontpanic345.tortoisespelling.integration

import java.time.Clock
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset

/** A clock in UTC that only moves when a test says so. Starts on Monday 2026-03-02, 09:00. */
class TestClock : Clock() {
    private var now: Instant = Instant.parse("2026-03-02T09:00:00Z")

    fun advanceDays(days: Long) {
        now = now.plusSeconds(days * 24 * 60 * 60)
    }

    override fun getZone(): ZoneId = ZoneOffset.UTC

    override fun withZone(zone: ZoneId): Clock = this

    override fun instant(): Instant = now
}
