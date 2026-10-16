package io.github.dontpanic345.tortoisespelling.golden

import io.github.dontpanic345.tortoisespelling.domain.WordContent
import io.github.dontpanic345.tortoisespelling.domain.apply
import io.github.dontpanic345.tortoisespelling.domain.exampleMissesForm
import io.github.dontpanic345.tortoisespelling.domain.isComplete
import io.github.dontpanic345.tortoisespelling.domain.preparedFor
import io.github.dontpanic345.tortoisespelling.domain.searchTerms
import io.github.dontpanic345.tortoisespelling.domain.simpleContent
import io.github.dontpanic345.tortoisespelling.golden.Golden.contentFrom
import io.github.dontpanic345.tortoisespelling.golden.Golden.expectedContent
import io.github.dontpanic345.tortoisespelling.golden.Golden.forEachCase
import org.junit.Assert.assertEquals
import kotlinx.serialization.json.jsonObject
import org.junit.Test

class ContentGoldenTest {
    private val file = Golden.load("content")

    @Test
    fun everyFunctionHasARunner() = Golden.assertFunctions(
        file,
        setOf(
            "blankContent", "simpleContent", "preparedFor", "isComplete", "apply", "searchTerms",
            "exampleMissesForm",
        ),
    )

    @Test
    fun blankContent() = forEachCase(file, "blankContent") { c ->
        assertEquals(expectedContent(c.getValue("out"), WordContent.blank()), WordContent.blank())
    }

    @Test
    fun simpleContent() = forEachCase(file, "simpleContent") { c ->
        val actual = simpleContent(c.str("word"), c.str("definition"), c.strOrNull("partOfSpeech"), c.str("example"))
        assertEquals(contentFrom(c.getValue("out")), actual)
    }

    @Test
    fun preparedFor() = forEachCase(file, "preparedFor") { c ->
        val input = contentFrom(c.getValue("content"))
        assertEquals(expectedContent(c.getValue("out"), input), input.preparedFor(c.str("word")))
    }

    @Test
    fun isComplete() = forEachCase(file, "isComplete") { c ->
        assertEquals(c.bool("out"), contentFrom(c.getValue("content")).isComplete())
    }

    @Test
    fun apply() = forEachCase(file, "apply") { c ->
        val input = contentFrom(c.getValue("content"))
        val edited = c.array("edits").fold(input) { content, edit -> content.apply(Golden.editFrom(edit.jsonObject)) }
        assertEquals(expectedContent(c.getValue("out"), input), edited)
    }

    @Test
    fun searchTerms() = forEachCase(file, "searchTerms") { c ->
        val terms = contentFrom(c.getValue("content")).searchTerms(c.str("word"))
        assertEquals(c.strings("out").toSet(), terms)
    }

    @Test
    fun exampleMissesForm() = forEachCase(file, "exampleMissesForm") { c ->
        assertEquals(c.bool("out"), exampleMissesForm(c.str("example"), c.str("form")))
    }
}
