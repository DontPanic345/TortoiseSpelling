package io.github.dontpanic345.tortoisespelling.golden

import io.github.dontpanic345.tortoisespelling.data.Definition
import io.github.dontpanic345.tortoisespelling.data.DefinitionWithForms
import io.github.dontpanic345.tortoisespelling.data.ExampleSentence
import io.github.dontpanic345.tortoisespelling.data.FormWithExamples
import io.github.dontpanic345.tortoisespelling.data.WordForm
import io.github.dontpanic345.tortoisespelling.data.WordWithContent
import io.github.dontpanic345.tortoisespelling.domain.ReviewCard
import io.github.dontpanic345.tortoisespelling.domain.pickCard
import io.github.dontpanic345.tortoisespelling.golden.Golden.forEachCase
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

class PickGoldenTest {
    private val file = Golden.load("pick")

    @Test
    fun everyFunctionHasARunner() = Golden.assertFunctions(file, setOf("pickCard", "answer", "hint"))

    /** The content as Room would load it, and where each example id sits as (definition, form, example). */
    private class Loaded(val content: WordWithContent, val positions: Map<Long, Triple<Int, Int, Int>>)

    private fun load(c: JsonObject): Loaded {
        val content = Golden.contentFrom(c.getValue("content"))
        val word = Golden.wordFrom(c.getValue("word").jsonObject)
        var nextId = 1L
        val positions = mutableMapOf<Long, Triple<Int, Int, Int>>()
        val definitions = content.definitions.mapIndexed { d, definition ->
            DefinitionWithForms(
                Definition(
                    id = nextId++, wordId = word.id, text = definition.text,
                    partOfSpeech = definition.partOfSpeech.ifEmpty { null }, orderIndex = d,
                ),
                definition.forms.mapIndexed { f, form ->
                    val formId = nextId++
                    FormWithExamples(
                        WordForm(
                            id = formId, definitionId = d.toLong(), text = form.text,
                            label = form.label.ifEmpty { null }, orderIndex = f,
                        ),
                        form.examples.mapIndexed { e, example ->
                            val id = nextId++
                            positions[id] = Triple(d, f, e)
                            ExampleSentence(
                                id = id, wordFormId = formId, text = example.text, orderIndex = e,
                                shownAt = example.shownAt,
                            )
                        },
                    )
                },
            )
        }
        return Loaded(WordWithContent(word, definitions), positions)
    }

    private fun nullable(value: String?): JsonElement = if (value == null) JsonNull else JsonPrimitive(value)

    /** The card's value for [key], as a case writes it. */
    private fun valueOf(card: ReviewCard, key: String, positions: Map<Long, Triple<Int, Int, Int>>): JsonElement =
        when (key) {
            "form" -> JsonPrimitive(card.form)
            "definition" -> JsonPrimitive(card.definition)
            "partOfSpeech" -> nullable(card.partOfSpeech)
            "label" -> nullable(card.label)
            "answer" -> JsonPrimitive(card.answer)
            "hint" -> nullable(card.hint)
            "example" -> card.example?.let { example ->
                val (d, f, e) = positions.getValue(example.id)
                buildJsonObject {
                    put("text", example.text)
                    put("shownAt", example.shownAt)
                    put("d", d)
                    put("f", f)
                    put("e", e)
                }
            } ?: JsonNull
            else -> error("unknown key $key")
        }

    @Test
    fun pickCard() = forEachCase(file, "pickCard") { c ->
        val loaded = load(c)
        val members = c.getValue("oneOf").let { it as kotlinx.serialization.json.JsonArray }.map { it.jsonObject }
        val seen = mutableSetOf<Int>()
        for (seed in Golden.SEEDS) {
            val card = pickCard(loaded.content, Random(seed))
            val matches = members.withIndex().filter { (_, member) ->
                member.all { (key, expected) -> valueOf(card, key, loaded.positions) == expected }
            }.map { it.index }
            assertTrue("seed $seed gave ${card.form} / ${card.example?.text}, which is none of the expected cards", matches.isNotEmpty())
            seen.addAll(matches)
        }
        if (c.boolOrNull("all") == true) {
            assertEquals("every expected card should come up", members.indices.toSet(), seen)
        }
    }

    @Test
    fun answer() = forEachCase(file, "answer") { c ->
        val card = ReviewCard(Golden.wordFrom(JsonObject(emptyMap())), "d", null, c.str("form"), null, null)
        assertEquals(c.str("out"), card.answer)
    }

    @Test
    fun hint() = forEachCase(file, "hint") { c ->
        val card = ReviewCard(
            Golden.wordFrom(JsonObject(emptyMap())), "d", c.strOrNull("partOfSpeech"), "ran", c.strOrNull("label"), null,
        )
        assertEquals(c.strOrNull("out"), card.hint)
    }
}
