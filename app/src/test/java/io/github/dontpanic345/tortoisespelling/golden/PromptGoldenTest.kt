package io.github.dontpanic345.tortoisespelling.golden

import io.github.dontpanic345.tortoisespelling.domain.lookupPrompt
import io.github.dontpanic345.tortoisespelling.golden.Golden.forEachCase
import org.junit.Assert.assertEquals
import org.junit.Test

class PromptGoldenTest {
    private val file = Golden.load("prompt")

    @Test
    fun everyFunctionHasARunner() = Golden.assertFunctions(file, setOf("lookupPrompt"))

    @Test
    fun lookupPrompt() = forEachCase(file, "lookupPrompt") { c ->
        assertEquals(c.str("out"), lookupPrompt(c.str("word")))
    }
}
