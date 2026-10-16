package io.github.dontpanic345.tortoisespelling.golden

import io.github.dontpanic345.tortoisespelling.domain.KNOWN_INTERVAL_DAYS
import io.github.dontpanic345.tortoisespelling.domain.WordFilter
import io.github.dontpanic345.tortoisespelling.domain.greeting
import io.github.dontpanic345.tortoisespelling.domain.learningStage
import io.github.dontpanic345.tortoisespelling.domain.matches
import io.github.dontpanic345.tortoisespelling.domain.recentDays
import io.github.dontpanic345.tortoisespelling.domain.wordFilterCounts
import io.github.dontpanic345.tortoisespelling.domain.wordProgress
import io.github.dontpanic345.tortoisespelling.golden.Golden.forEachCase
import io.github.dontpanic345.tortoisespelling.golden.Golden.wordFrom
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Test

class ProgressGoldenTest {
    private val file = Golden.load("progress")

    @Test
    fun everyFunctionHasARunner() = Golden.assertFunctions(
        file,
        setOf("constants", "learningStage", "wordProgress", "matches", "wordFilterCounts", "recentDays", "greeting"),
    )

    @Test
    fun constants() = forEachCase(file, "constants") { c ->
        assertEquals(c.int("KNOWN_INTERVAL_DAYS"), KNOWN_INTERVAL_DAYS)
        assertEquals(c.strings("filters"), WordFilter.entries.map { it.name })
        val labels = c.getValue("labels").jsonObject
        for (filter in WordFilter.entries) {
            assertEquals(labels.str(filter.name), filter.label)
        }
    }

    @Test
    fun learningStage() = forEachCase(file, "learningStage") { c ->
        assertEquals(c.strOrNull("out"), learningStage(wordFrom(c.getValue("word").jsonObject))?.name)
    }

    @Test
    fun wordProgress() = forEachCase(file, "wordProgress") { c ->
        val progress = wordProgress(c.array("words").map { wordFrom(it.jsonObject) })
        val out = c.getValue("out").jsonObject
        assertEquals(out.int("new"), progress.new)
        assertEquals(out.int("learning"), progress.learning)
        assertEquals(out.int("known"), progress.known)
        assertEquals(out.int("total"), progress.total)
    }

    @Test
    fun matches() = forEachCase(file, "matches") { c ->
        val filter = WordFilter.valueOf(c.str("filter"))
        assertEquals(c.bool("out"), filter.matches(wordFrom(c.getValue("word").jsonObject), c.long("today")))
    }

    @Test
    fun wordFilterCounts() = forEachCase(file, "wordFilterCounts") { c ->
        val counts = wordFilterCounts(c.array("words").map { wordFrom(it.jsonObject) }, c.long("today"))
        val out = c.getValue("out").jsonObject
        assertEquals(WordFilter.entries.map { it.name }.toSet(), out.keys)
        for (filter in WordFilter.entries) {
            assertEquals(filter.name, out.int(filter.name), counts.getValue(filter))
        }
    }

    @Test
    fun recentDays() = forEachCase(file, "recentDays") { c ->
        val firstDay = c.longOrNull("firstDay")
        val studyDays = c.longs("studyDays").toSet()
        val satisfiedDays = c.longs("satisfiedDays").toSet()
        val days = c.intOrNull("count")?.let { recentDays(c.long("today"), studyDays, satisfiedDays, firstDay, it) }
            ?: recentDays(c.long("today"), studyDays, satisfiedDays, firstDay)
        assertEquals(c.longs("days"), days.map { it.day })
        assertEquals(c.strings("marks"), days.map { it.mark.name })
    }

    @Test
    fun greeting() = forEachCase(file, "greeting") { c ->
        assertEquals(c.str("out"), greeting(c.int("hour")))
    }
}
