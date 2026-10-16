package io.github.dontpanic345.tortoisespelling.golden

import io.github.dontpanic345.tortoisespelling.domain.PastedLookup
import io.github.dontpanic345.tortoisespelling.domain.isBlank
import io.github.dontpanic345.tortoisespelling.domain.parsePastedLookup
import io.github.dontpanic345.tortoisespelling.domain.summary
import io.github.dontpanic345.tortoisespelling.golden.Golden.contentFrom
import io.github.dontpanic345.tortoisespelling.golden.Golden.forEachCase
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PasteGoldenTest {
    private val file = Golden.load("paste")

    @Test
    fun everyFunctionHasARunner() = Golden.assertFunctions(file, setOf("parsePastedLookup", "summary", "isBlank"))

    @Test
    fun parsePastedLookup() = forEachCase(file, "parsePastedLookup") { c ->
        val result = parsePastedLookup(Golden.textFrom(c.getValue("text")), c.strOrNull("typedWord") ?: "practice")
        val out = c.getValue("out").jsonObject
        when (val kind = out.str("kind")) {
            "invalid" -> assertEquals(PastedLookup.Invalid(out.str("message")), result)
            "valid" -> {
                assertTrue("expected a valid answer but got $result", result is PastedLookup.Valid)
                result as PastedLookup.Valid
                assertTrue("a valid case checks its content or its summary", "content" in out || "summary" in out)
                assertEquals(out.str("word"), result.word)
                assertEquals(out.bool("renames"), result.renames)
                out["content"]?.let { assertEquals(contentFrom(it), result.content) }
                out.strOrNull("summary")?.let { assertEquals(it, result.content.summary()) }
            }
            else -> error("unknown kind $kind")
        }
    }

    @Test
    fun summary() = forEachCase(file, "summary") { c ->
        assertEquals(c.str("out"), contentFrom(c.getValue("content")).summary())
    }

    @Test
    fun isBlank() = forEachCase(file, "isBlank") { c ->
        assertEquals(c.bool("out"), contentFrom(c.getValue("content")).isBlank())
    }
}
