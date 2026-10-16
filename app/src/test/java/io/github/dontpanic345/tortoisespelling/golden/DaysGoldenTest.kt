package io.github.dontpanic345.tortoisespelling.golden

import io.github.dontpanic345.tortoisespelling.domain.Days
import io.github.dontpanic345.tortoisespelling.golden.Golden.forEachCase
import java.time.Clock
import java.time.Instant
import java.time.ZoneId
import org.junit.Assert.assertEquals
import org.junit.Test

class DaysGoldenTest {
    private val file = Golden.load("days")

    @Test
    fun everyFunctionHasARunner() =
        Golden.assertFunctions(file, setOf("today", "dayOf", "relativeLabel", "currentStreak"))

    @Test
    fun today() = forEachCase(file, "today") { c ->
        val clock = Clock.fixed(Instant.ofEpochMilli(c.long("millis")), ZoneId.of(c.str("zone")))
        assertEquals(c.long("out"), Days.today(clock))
    }

    @Test
    fun dayOf() = forEachCase(file, "dayOf") { c ->
        assertEquals(c.long("out"), Days.dayOf(c.long("millis"), ZoneId.of(c.str("zone"))))
    }

    @Test
    fun relativeLabel() = forEachCase(file, "relativeLabel") { c ->
        assertEquals(c.str("out"), Days.relativeLabel(c.long("day"), c.long("today")))
    }

    @Test
    fun currentStreak() = forEachCase(file, "currentStreak") { c ->
        val satisfied = if ("satisfiedDays" in c) c.longs("satisfiedDays").toSet() else emptySet()
        val streak = Days.currentStreak(c.longs("studyDays").toSet(), c.long("today"), satisfied)
        assertEquals(c.int("out"), streak)
    }
}
