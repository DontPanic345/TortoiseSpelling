package io.github.dontpanic345.tortoisespelling.golden

import io.github.dontpanic345.tortoisespelling.domain.interleaveSession
import io.github.dontpanic345.tortoisespelling.domain.remainingNewToday
import io.github.dontpanic345.tortoisespelling.golden.Golden.forEachCase
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

class SessionGoldenTest {
    private val file = Golden.load("session")

    @Test
    fun everyFunctionHasARunner() =
        Golden.assertFunctions(file, setOf("remainingNewToday", "interleaveSession"))

    @Test
    fun remainingNewToday() = forEachCase(file, "remainingNewToday") { c ->
        assertEquals(c.int("out"), remainingNewToday(c.int("newWordsPerDay"), c.int("introducedToday")))
    }

    @Test
    fun interleaveSession() = forEachCase(file, "interleaveSession") { c ->
        val dueIds = c.longs("due")
        val freshIds = c.longs("fresh")
        val due = dueIds.map { Golden.wordFrom(buildJsonObject { put("id", it) }) }
        val fresh = freshIds.map { Golden.wordFrom(buildJsonObject { put("id", it) }) }
        val orders = mutableSetOf<List<Long>>()
        for (seed in Golden.SEEDS) {
            val ids = interleaveSession(due, fresh, Random(seed)).map { it.id }
            assertEquals((dueIds + freshIds).sorted(), ids.sorted())
            val at = ids.withIndex().filter { it.value in freshIds }.map { it.index }
            assertEquals(c.ints("freshAt"), at)
            orders.add(ids)
        }
        if (c.boolOrNull("varies") == true) {
            assertTrue("the order should vary with the seed", orders.size > 1)
        }
    }
}
