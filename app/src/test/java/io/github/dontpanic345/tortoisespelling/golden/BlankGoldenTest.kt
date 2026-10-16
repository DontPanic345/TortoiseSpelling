package io.github.dontpanic345.tortoisespelling.golden

import io.github.dontpanic345.tortoisespelling.domain.blankWordIn
import io.github.dontpanic345.tortoisespelling.domain.hideWordInDefinition
import io.github.dontpanic345.tortoisespelling.golden.Golden.forEachCase
import org.junit.Assert.assertEquals
import org.junit.Test

class BlankGoldenTest {
    private val file = Golden.load("blank")

    @Test
    fun everyFunctionHasARunner() =
        Golden.assertFunctions(file, setOf("blankWordIn", "hideWordInDefinition"))

    @Test
    fun blankWordIn() = forEachCase(file, "blankWordIn") { c ->
        val result = blankWordIn(c.str("sentence"), c.str("word"))
        assertEquals(c.str("text"), result.text)
        assertEquals(c.bool("didBlank"), result.didBlank)
    }

    @Test
    fun hideWordInDefinition() = forEachCase(file, "hideWordInDefinition") { c ->
        assertEquals(c.str("out"), hideWordInDefinition(c.str("definition"), c.str("word")))
    }
}
