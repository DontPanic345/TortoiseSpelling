package io.github.dontpanic345.tortoisespelling.golden

import io.github.dontpanic345.tortoisespelling.domain.spellingDiff
import io.github.dontpanic345.tortoisespelling.golden.Golden.forEachCase
import org.junit.Assert.assertEquals
import org.junit.Test

class DiffGoldenTest {
    private val file = Golden.load("diff")

    @Test
    fun everyFunctionHasARunner() = Golden.assertFunctions(file, setOf("spellingDiff"))

    @Test
    fun spellingDiff() = forEachCase(file, "spellingDiff") { c ->
        val diff = spellingDiff(c.str("expected"), c.str("actual"))
        assertEquals(c.int("firstDivergence"), diff.firstDivergence)
        assertEquals(c.bool("matches"), diff.matches)
        assertEquals(c.int("correctPrefixLength"), diff.correctPrefixLength)
    }
}
