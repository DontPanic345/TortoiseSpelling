package io.github.dontpanic345.tortoisespelling.domain

import io.github.dontpanic345.tortoisespelling.data.normalizeWord
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

sealed interface PastedLookup {
    /** [word] is the answer's spelling; [renames] is true when it differs from the typed word. */
    data class Valid(val word: String, val content: WordContent, val renames: Boolean) : PastedLookup
    data class Invalid(val message: String) : PastedLookup
}

/** `FORMS` is per definition and `EXAMPLES` per form; `WORD` also limits a form's text. */
object PasteLimits {
    const val TEXT = 20_000
    const val DEFINITIONS = 8
    const val FORMS = 12
    const val EXAMPLES = 6
    const val WORD = 60
    const val DEFINITION = 300
    const val PART_OF_SPEECH = 30
    const val LABEL = 40
    const val EXAMPLE = 300
}

private const val TOO_LONG = "That's too long to be one word's answer."
private const val NOT_JSON = "That isn't the JSON the prompt asks for. Copy the chat's whole answer and paste it again."
private const val OVER_LIMIT = "That answer is longer than a word needs. Ask the chat for a shorter one."

private class Rejected(override val message: String) : Exception(message)

private fun reject(message: String): Nothing = throw Rejected(message)

/** The trimmed string, or "" when the value is missing or isn't a JSON string. */
private fun JsonElement?.string(): String =
    (this as? JsonPrimitive)?.takeIf { it.isString }?.content?.trim().orEmpty()

private fun JsonElement?.items(): List<JsonElement> = (this as? JsonArray) ?: emptyList()

/**
 * Validates a chat AI's reply to [lookupPrompt] and turns it into content. The JSON is
 * located (first `{` to last `}`), never repaired; the first failure is the result.
 */
fun parsePastedLookup(text: String, typedWord: String): PastedLookup = try {
    parseOrReject(text, typedWord)
} catch (rejected: Rejected) {
    PastedLookup.Invalid(rejected.message)
}

private fun parseOrReject(text: String, typedWord: String): PastedLookup.Valid {
    if (text.length > PasteLimits.TEXT) reject(TOO_LONG)
    val start = text.indexOf('{')
    val end = text.lastIndexOf('}')
    if (start < 0 || end < start) reject(NOT_JSON)
    val root = try {
        Json.parseToJsonElement(text.substring(start, end + 1)) as? JsonObject
    } catch (_: Exception) {
        null
    } ?: reject(NOT_JSON)

    val word = root["word"].string()
    if (word.isEmpty()) reject("The answer has no \"word\".")
    val rawDefinitions = (root["definitions"] as? JsonArray)?.takeIf { it.isNotEmpty() }
        ?: reject("The answer has no definitions.")

    var tooLong = rawDefinitions.size > PasteLimits.DEFINITIONS || word.length > PasteLimits.WORD
    val definitions = rawDefinitions.mapIndexed { index, element ->
        val n = index + 1
        val definition = element as? JsonObject
        val definitionText = definition?.get("text").string()
        if (definitionText.isEmpty()) reject("Definition $n has no text.")
        val rawForms = definition?.get("forms").items()
        if (rawForms.isEmpty()) reject("Definition $n has no forms.")
        val partOfSpeech = definition?.get("partOfSpeech").string()
        tooLong = tooLong || rawForms.size > PasteLimits.FORMS ||
            definitionText.length > PasteLimits.DEFINITION ||
            partOfSpeech.length > PasteLimits.PART_OF_SPEECH
        val forms = rawForms.map { rawForm ->
            val form = rawForm as? JsonObject
            val formText = form?.get("text").string()
            if (formText.isEmpty()) reject("A form in definition $n has no text.")
            val examples = form?.get("examples").items().map { it.string() }.filter { it.isNotEmpty() }
            if (examples.isEmpty()) reject("“$formText” has no example sentence.")
            examples.firstOrNull { exampleMissesForm(it, formText) }?.let {
                reject("“$it” doesn't contain “$formText”.")
            }
            val label = form?.get("label").string()
            tooLong = tooLong || formText.length > PasteLimits.WORD || label.length > PasteLimits.LABEL ||
                examples.size > PasteLimits.EXAMPLES || examples.any { it.length > PasteLimits.EXAMPLE }
            FormDraft(formText, label, examples.map { ExampleDraft(it) })
        }
        DefinitionDraft(definitionText, partOfSpeech, forms)
    }
    if (tooLong) reject(OVER_LIMIT)

    return PastedLookup.Valid(
        word = word,
        content = WordContent(definitions).withBaseForm(word),
        renames = typedWord.isNotBlank() && normalizeWord(word) != normalizeWord(typedWord),
    )
}

/** Moves the first form spelled [word] to the front of the first definition, or adds one. */
private fun WordContent.withBaseForm(word: String): WordContent {
    val first = definitions.first()
    val at = first.forms.indexOfFirst { normalizeWord(it.text) == normalizeWord(word) }
    val forms = when {
        at < 0 -> listOf(FormDraft(text = word)) + first.forms
        else -> listOf(first.forms[at]) + first.forms.filterIndexed { i, _ -> i != at }
    }
    return WordContent(listOf(first.copy(forms = forms)) + definitions.drop(1))
}

private fun count(n: Int, singular: String, plural: String) = "$n ${if (n == 1) singular else plural}"

/** "2 definitions, 4 forms, 4 example sentences", singular for 1. */
fun WordContent.summary(): String {
    val forms = definitions.flatMap { it.forms }
    return listOf(
        count(definitions.size, "definition", "definitions"),
        count(forms.size, "form", "forms"),
        count(forms.sumOf { it.examples.size }, "example sentence", "example sentences"),
    ).joinToString(", ")
}

/** True when every definition, part of speech, form, label and example is blank. */
fun WordContent.isBlank(): Boolean = definitions.all { definition ->
    definition.text.isBlank() && definition.partOfSpeech.isBlank() && definition.forms.all { form ->
        form.text.isBlank() && form.label.isBlank() && form.examples.all { it.text.isBlank() }
    }
}
