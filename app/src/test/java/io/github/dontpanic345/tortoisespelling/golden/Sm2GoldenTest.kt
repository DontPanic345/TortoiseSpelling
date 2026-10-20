package io.github.dontpanic345.tortoisespelling.golden

import io.github.dontpanic345.tortoisespelling.data.Grade
import io.github.dontpanic345.tortoisespelling.domain.MAX_INTERVAL_DAYS
import io.github.dontpanic345.tortoisespelling.domain.NewWordState
import io.github.dontpanic345.tortoisespelling.domain.RESET_BELOW_QUALITY
import io.github.dontpanic345.tortoisespelling.domain.Sm2Scheduler
import io.github.dontpanic345.tortoisespelling.domain.SrsState
import io.github.dontpanic345.tortoisespelling.domain.allCorrectIntervals as computeAllCorrectIntervals
import io.github.dontpanic345.tortoisespelling.domain.fuzzedDueDay
import io.github.dontpanic345.tortoisespelling.golden.Golden.assertState
import io.github.dontpanic345.tortoisespelling.golden.Golden.forEachCase
import io.github.dontpanic345.tortoisespelling.golden.Golden.srsStateFrom
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

class Sm2GoldenTest {
    private val file = Golden.load("sm2")

    @Test
    fun everyFunctionHasARunner() =
        Golden.assertFunctions(file, setOf("constants", "next", "sequence", "allCorrectIntervals", "fuzzedDueDay"))

    @Test
    fun constants() = forEachCase(file, "constants") { c ->
        assertEquals(c.int("MAX_INTERVAL_DAYS"), MAX_INTERVAL_DAYS)
        assertEquals(c.int("RESET_BELOW_QUALITY"), RESET_BELOW_QUALITY)
        assertState(srsStateFrom(c.getValue("NEW_WORD_STATE")), NewWordState)
        val grade = c.getValue("Grade").jsonObject
        assertEquals(grade.int("FIRST_TRY"), Grade.FIRST_TRY)
        assertEquals(grade.int("AFTER_RETYPE"), Grade.AFTER_RETYPE)
        assertEquals(grade.int("GAVE_UP"), Grade.GAVE_UP)
    }

    @Test
    fun next() = forEachCase(file, "next") { c ->
        val next = Sm2Scheduler.next(srsStateFrom(c.getValue("prev")), c.int("quality"))
        assertState(srsStateFrom(c.getValue("out")), next)
    }

    @Test
    fun sequence() = forEachCase(file, "sequence") { c ->
        var state: SrsState = NewWordState
        for (quality in c.ints("qualities")) {
            state = Sm2Scheduler.next(state, quality)
        }
        assertState(srsStateFrom(c.getValue("out")), state)
    }

    @Test
    fun allCorrectIntervals() = forEachCase(file, "allCorrectIntervals") { c ->
        assertEquals(c.ints("out"), computeAllCorrectIntervals())
    }

    @Test
    fun fuzzedDueDay() = forEachCase(file, "fuzzedDueDay") { c ->
        val (low, high) = c.longs("within")
        val results = Golden.SEEDS.map { fuzzedDueDay(c.long("today"), c.int("intervalDays"), Random(it)) }
        assertTrue("results $results outside $low..$high", results.all { it in low..high })
        if (c.boolOrNull("varies") == true) {
            assertTrue("fuzz should vary", results.toSet().size > 1)
        }
        if (c.boolOrNull("all") == true) {
            assertEquals((low..high).toSet(), results.toSet())
        }
    }
}
