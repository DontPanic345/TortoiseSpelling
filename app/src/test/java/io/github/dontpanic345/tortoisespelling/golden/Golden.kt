package io.github.dontpanic345.tortoisespelling.golden

import io.github.dontpanic345.tortoisespelling.data.Word
import io.github.dontpanic345.tortoisespelling.data.normalizeWord
import io.github.dontpanic345.tortoisespelling.domain.ContentEdit
import io.github.dontpanic345.tortoisespelling.domain.DefinitionDraft
import io.github.dontpanic345.tortoisespelling.domain.ExampleDraft
import io.github.dontpanic345.tortoisespelling.domain.FormDraft
import io.github.dontpanic345.tortoisespelling.domain.SrsState
import io.github.dontpanic345.tortoisespelling.domain.WordContent
import io.github.dontpanic345.tortoisespelling.domain.lookupPrompt
import java.io.File
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue

/**
 * The shared golden cases (the `.json` files in `golden/` at the repo root), read the same way by the
 * Vitest runner in `web/test/golden`. See `golden/README.md` for the format.
 */
object Golden {
    /** Seeds every random case is run over. */
    val SEEDS = 0..49

    private val dir: File = File(requireNotNull(System.getProperty("golden.dir")) { "golden.dir is not set" })

    fun load(name: String): JsonObject =
        Json.parseToJsonElement(File(dir, "$name.json").readText()).jsonObject

    /** The file has exactly these functions, so no case sits unread. */
    fun assertFunctions(file: JsonObject, known: Set<String>) {
        assertEquals(known, file.keys - "about")
    }

    /** Runs [check] on every case of [function], naming the failing case. */
    fun forEachCase(file: JsonObject, function: String, check: (JsonObject) -> Unit) {
        val cases = file.getValue(function).jsonArray
        assertTrue("no cases for $function", cases.isNotEmpty())
        for (element in cases) {
            val case = element.jsonObject
            try {
                check(case)
            } catch (e: AssertionError) {
                throw AssertionError("$function: ${case.str("name")}: ${e.message}", e)
            }
        }
    }

    /** A Word from a case: only the fields it lists, the rest as Word's own defaults. */
    fun wordFrom(case: JsonObject): Word {
        val text = case.strOrNull("text") ?: "cat"
        return Word(
            id = case.longOrNull("id") ?: 0,
            text = text,
            normalizedText = normalizeWord(text),
            createdAt = case.longOrNull("createdAt") ?: 0,
            repetitions = case.intOrNull("repetitions") ?: 0,
            easeFactor = case.doubleOrNull("easeFactor") ?: 2.5,
            intervalDays = case.intOrNull("intervalDays") ?: 0,
            dueOn = case.longOrNull("dueOn") ?: 0,
            lapses = case.intOrNull("lapses") ?: 0,
            lastReviewedAt = case.longOrNull("lastReviewedAt"),
            firstReviewedOn = case.longOrNull("firstReviewedOn"),
            isNew = case.boolOrNull("isNew") ?: true,
            suspended = case.boolOrNull("suspended") ?: false,
        )
    }

    /** Content from a case: the `WordContent` shape with blanks left out, or "blank" for a new word's draft. */
    fun contentFrom(element: JsonElement): WordContent {
        if (element is JsonPrimitive && element.content == "blank") return WordContent.blank()
        return WordContent(
            element.jsonObject.array("definitions").map { definition ->
                val d = definition.jsonObject
                DefinitionDraft(
                    text = d.str("text"),
                    partOfSpeech = d.strOrNull("partOfSpeech") ?: "",
                    forms = d.array("forms").map { form ->
                        val f = form.jsonObject
                        FormDraft(
                            text = f.str("text"),
                            label = f.strOrNull("label") ?: "",
                            examples = (f["examples"]?.jsonArray ?: JsonArray(emptyList())).map { example ->
                                val e = example.jsonObject
                                ExampleDraft(e.str("text"), e.longOrNull("shownAt"))
                            },
                        )
                    },
                )
            },
        )
    }

    /** The expected content of a case: its `out`, where "same" means [input] unchanged. */
    fun expectedContent(out: JsonElement, input: WordContent): WordContent =
        if (out is JsonPrimitive && out.content == "same") input else contentFrom(out)

    /** An edit as a case writes it: `{ "edit": "AddForm", "d": 0 }`. */
    fun editFrom(edit: JsonObject): ContentEdit = when (val kind = edit.str("edit")) {
        "DefinitionText" -> ContentEdit.DefinitionText(edit.int("d"), edit.str("value"))
        "PartOfSpeech" -> ContentEdit.PartOfSpeech(edit.int("d"), edit.str("value"))
        "FormText" -> ContentEdit.FormText(edit.int("d"), edit.int("f"), edit.str("value"))
        "FormLabel" -> ContentEdit.FormLabel(edit.int("d"), edit.int("f"), edit.str("value"))
        "ExampleText" -> ContentEdit.ExampleText(edit.int("d"), edit.int("f"), edit.int("e"), edit.str("value"))
        "AddDefinition" -> ContentEdit.AddDefinition
        "RemoveDefinition" -> ContentEdit.RemoveDefinition(edit.int("d"))
        "AddForm" -> ContentEdit.AddForm(edit.int("d"))
        "RemoveForm" -> ContentEdit.RemoveForm(edit.int("d"), edit.int("f"))
        "AddExample" -> ContentEdit.AddExample(edit.int("d"), edit.int("f"))
        "RemoveExample" -> ContentEdit.RemoveExample(edit.int("d"), edit.int("f"), edit.int("e"))
        else -> error("unknown edit $kind")
    }

    /** Pasted text from a case: a string, or parts joined: a string, `{ repeat, times }` or `{ prompt }`. */
    fun textFrom(element: JsonElement): String {
        if (element is JsonPrimitive) return element.content
        return element.jsonArray.joinToString("") { part ->
            if (part is JsonPrimitive) {
                part.content
            } else {
                val p = part.jsonObject
                if ("prompt" in p) lookupPrompt(p.str("prompt")) else p.str("repeat").repeat(p.int("times"))
            }
        }
    }

    fun srsStateFrom(element: JsonElement): SrsState {
        val state = element.jsonObject
        return SrsState(state.int("repetitions"), state.double("easeFactor"), state.int("intervalDays"))
    }

    /** Doubles compare within 1e-9. */
    fun assertState(expected: SrsState, actual: SrsState) {
        assertEquals(expected.repetitions, actual.repetitions)
        assertEquals(expected.easeFactor, actual.easeFactor, 1e-9)
        assertEquals(expected.intervalDays, actual.intervalDays)
    }
}

private fun JsonObject.value(key: String): JsonPrimitive? =
    this[key]?.takeIf { it !is JsonNull }?.jsonPrimitive

fun JsonObject.str(key: String): String = getValue(key).jsonPrimitive.content
fun JsonObject.int(key: String): Int = getValue(key).jsonPrimitive.int
fun JsonObject.long(key: String): Long = getValue(key).jsonPrimitive.long
fun JsonObject.double(key: String): Double = getValue(key).jsonPrimitive.double
fun JsonObject.bool(key: String): Boolean = getValue(key).jsonPrimitive.boolean
fun JsonObject.strOrNull(key: String): String? = value(key)?.content
fun JsonObject.intOrNull(key: String): Int? = value(key)?.int
fun JsonObject.longOrNull(key: String): Long? = value(key)?.long
fun JsonObject.doubleOrNull(key: String): Double? = value(key)?.double
fun JsonObject.boolOrNull(key: String): Boolean? = value(key)?.boolean
fun JsonObject.array(key: String): JsonArray = getValue(key).jsonArray
fun JsonObject.longs(key: String): List<Long> = array(key).map { it.jsonPrimitive.long }
fun JsonObject.ints(key: String): List<Int> = array(key).map { it.jsonPrimitive.int }
fun JsonObject.strings(key: String): List<String> = array(key).map { it.jsonPrimitive.content }
