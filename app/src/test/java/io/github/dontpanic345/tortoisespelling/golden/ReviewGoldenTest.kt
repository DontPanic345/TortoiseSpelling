package io.github.dontpanic345.tortoisespelling.golden

import io.github.dontpanic345.tortoisespelling.data.ReviewLog
import io.github.dontpanic345.tortoisespelling.data.Word
import io.github.dontpanic345.tortoisespelling.domain.reviewed
import io.github.dontpanic345.tortoisespelling.golden.Golden.forEachCase
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Test

class ReviewGoldenTest {
    private val file = Golden.load("review")

    @Test
    fun everyFunctionHasARunner() = Golden.assertFunctions(file, setOf("reviewed"))

    @Test
    fun reviewed() = forEachCase(file, "reviewed") { c ->
        val result = reviewed(
            word = Golden.wordFrom(c.getValue("word").jsonObject),
            correctFirstTry = c.bool("correctFirstTry"),
            typedAnswer = c.str("typedAnswer"),
            today = c.long("today"),
            now = c.long("now"),
            fuzz = { t, i -> t + i },
        )
        val out = c.getValue("out").jsonObject
        assertWord(out.getValue("word").jsonObject, result.word)
        val log = out.getValue("log").jsonObject
        assertEquals(
            ReviewLog(
                wordId = log.long("wordId"),
                reviewedAt = log.long("reviewedAt"),
                reviewedOn = log.long("reviewedOn"),
                grade = log.int("grade"),
                correct = log.bool("correct"),
                typedAnswer = log.str("typedAnswer"),
            ),
            result.log,
        )
    }

    /** The fields [expected] lists; the ease factor within 1e-9. */
    private fun assertWord(expected: JsonObject, actual: Word) {
        for (key in expected.keys) {
            when (key) {
                "id" -> assertEquals(key, expected.long(key), actual.id)
                "repetitions" -> assertEquals(key, expected.int(key), actual.repetitions)
                "easeFactor" -> assertEquals(key, expected.double(key), actual.easeFactor, 1e-9)
                "intervalDays" -> assertEquals(key, expected.int(key), actual.intervalDays)
                "dueOn" -> assertEquals(key, expected.long(key), actual.dueOn)
                "lapses" -> assertEquals(key, expected.int(key), actual.lapses)
                "lastReviewedAt" -> assertEquals(key, expected.longOrNull(key), actual.lastReviewedAt)
                "firstReviewedOn" -> assertEquals(key, expected.longOrNull(key), actual.firstReviewedOn)
                "isNew" -> assertEquals(key, expected.bool(key), actual.isNew)
                "suspended" -> assertEquals(key, expected.bool(key), actual.suspended)
                else -> error("unknown word field $key")
            }
        }
    }
}
