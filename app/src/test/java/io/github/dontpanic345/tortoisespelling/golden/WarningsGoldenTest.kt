package io.github.dontpanic345.tortoisespelling.golden

import io.github.dontpanic345.tortoisespelling.domain.formWarnings
import io.github.dontpanic345.tortoisespelling.golden.Golden.forEachCase
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Test

class WarningsGoldenTest {
    private val file = Golden.load("warnings")

    @Test
    fun everyFunctionHasARunner() = Golden.assertFunctions(file, setOf("formWarnings"))

    @Test
    fun formWarnings() = forEachCase(file, "formWarnings") { c ->
        val out = formWarnings(c.str("word"), Golden.contentFrom(c.getValue("content")))
        val expected = c.array("out").map { it.jsonObject }.map { Triple(it.int("definition"), it.int("form"), it.str("message")) }
        assertEquals(expected, out.map { Triple(it.definition, it.form, it.message) })
    }
}
