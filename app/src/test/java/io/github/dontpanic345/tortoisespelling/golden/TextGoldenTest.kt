package io.github.dontpanic345.tortoisespelling.golden

import io.github.dontpanic345.tortoisespelling.data.normalizeWord
import io.github.dontpanic345.tortoisespelling.golden.Golden.forEachCase
import org.junit.Assert.assertEquals
import org.junit.Test

class TextGoldenTest {
    private val file = Golden.load("text")

    @Test
    fun everyFunctionHasARunner() =
        Golden.assertFunctions(file, setOf("normalizeWord", "ktTrim", "ktIsBlank"))

    @Test
    fun normalizeWord() = forEachCase(file, "normalizeWord") { c ->
        assertEquals(c.str("out"), normalizeWord(c.str("in")))
    }

    @Test
    fun ktTrim() = forEachCase(file, "ktTrim") { c ->
        assertEquals(c.str("out"), c.str("in").trim())
    }

    @Test
    fun ktIsBlank() = forEachCase(file, "ktIsBlank") { c ->
        assertEquals(c.bool("out"), c.str("in").isBlank())
    }
}
