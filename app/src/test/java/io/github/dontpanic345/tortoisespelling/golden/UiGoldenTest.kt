package io.github.dontpanic345.tortoisespelling.golden

import io.github.dontpanic345.tortoisespelling.data.ExampleSentence
import io.github.dontpanic345.tortoisespelling.domain.PastedLookup
import io.github.dontpanic345.tortoisespelling.domain.ReviewCard
import io.github.dontpanic345.tortoisespelling.domain.WordFilter
import io.github.dontpanic345.tortoisespelling.golden.Golden.contentFrom
import io.github.dontpanic345.tortoisespelling.golden.Golden.forEachCase
import io.github.dontpanic345.tortoisespelling.golden.Golden.wordFrom
import io.github.dontpanic345.tortoisespelling.golden.Golden.wordWithContentFrom
import io.github.dontpanic345.tortoisespelling.ui.add.AddWordUiState
import io.github.dontpanic345.tortoisespelling.ui.add.PasteDraft
import io.github.dontpanic345.tortoisespelling.ui.complete.completionHeadline
import io.github.dontpanic345.tortoisespelling.ui.review.ReviewUiState
import io.github.dontpanic345.tortoisespelling.ui.settings.importMessage
import io.github.dontpanic345.tortoisespelling.ui.words.filterRows
import io.github.dontpanic345.tortoisespelling.ui.words.noMatchesBody
import io.github.dontpanic345.tortoisespelling.ui.words.statusLabel
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class UiGoldenTest {
    private val file = Golden.load("ui")

    @Test
    fun everyFunctionHasARunner() = Golden.assertFunctions(
        file,
        setOf(
            "statusLabel", "noMatchesBody", "filterRows", "completionHeadline", "importMessage",
            "blankedExample", "canSave", "applying",
        ),
    )

    @Test
    fun statusLabel() = forEachCase(file, "statusLabel") { c ->
        assertEquals(c.str("out"), statusLabel(wordFrom(c.getValue("word").jsonObject), c.long("today")))
    }

    @Test
    fun noMatchesBody() = forEachCase(file, "noMatchesBody") { c ->
        assertEquals(c.str("out"), noMatchesBody(c.str("query"), WordFilter.valueOf(c.str("filter"))))
    }

    @Test
    fun filterRows() = forEachCase(file, "filterRows") { c ->
        val words = c.array("words").map { wordWithContentFrom(it.jsonObject) }
        val rows = filterRows(words, c.str("query"), WordFilter.valueOf(c.str("filter")), c.long("today"))
        val expected = c.array("out").map { it.jsonObject }.map { Triple(it.str("text"), it.str("status"), it.str("definition")) }
        assertEquals(expected, rows.map { Triple(it.word.text, it.status, it.definition) })
    }

    @Test
    fun completionHeadline() = forEachCase(file, "completionHeadline") { c ->
        assertEquals(c.str("out"), completionHeadline(c.longOrNull("nextDueDay"), c.long("today")))
    }

    @Test
    fun importMessage() = forEachCase(file, "importMessage") { c ->
        assertEquals(c.str("out"), importMessage(c.int("added"), c.int("skipped")))
    }

    @Test
    fun blankedExample() = forEachCase(file, "blankedExample") { c ->
        val example = c.strOrNull("example")?.let { ExampleSentence(wordFormId = 1, text = it, orderIndex = 0) }
        val card = ReviewCard(wordFrom(JsonObject(emptyMap())), "", null, c.str("form"), null, example)
        val blanked = ReviewUiState(loading = false, queue = listOf(card)).blankedExample
        val out = c.getValue("out")
        if (out is JsonNull) {
            assertNull(blanked)
        } else {
            assertEquals(out.jsonObject.str("text"), blanked?.text)
            assertEquals(out.jsonObject.bool("didBlank"), blanked?.didBlank)
        }
    }

    @Test
    fun canSave() = forEachCase(file, "canSave") { c ->
        val state = AddWordUiState(text = c.str("text"), content = contentFrom(c.getValue("content")))
        assertEquals(c.bool("out"), state.canSave)
    }

    @Test
    fun applying() = forEachCase(file, "applying") { c ->
        val s = c.getValue("state").jsonObject
        val state = AddWordUiState(
            editingId = s.longOrNull("editingId"),
            text = s.str("text"),
            content = contentFrom(s.getValue("content")),
            paste = s.strOrNull("pasteText")?.let { PasteDraft(it) },
            message = s.strOrNull("message"),
            addedThisSession = s.intOrNull("addedThisSession") ?: 0,
            totalWords = s.intOrNull("totalWords") ?: 0,
        )
        val a = c.getValue("answer").jsonObject
        val actual = state.applying(PastedLookup.Valid(a.str("word"), contentFrom(a.getValue("content")), a.bool("renames")))

        val out = c.getValue("out").jsonObject
        assertEquals(out.longOrNull("editingId"), actual.editingId)
        assertEquals(out.str("text"), actual.text)
        assertEquals(contentFrom(out.getValue("content")), actual.content)
        assertNull(actual.paste)
        assertEquals(out.strOrNull("message"), actual.message)
        assertEquals(out.intOrNull("addedThisSession") ?: 0, actual.addedThisSession)
        assertEquals(out.intOrNull("totalWords") ?: 0, actual.totalWords)
    }
}
