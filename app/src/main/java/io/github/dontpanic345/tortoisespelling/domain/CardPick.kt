package io.github.dontpanic345.tortoisespelling.domain

import io.github.dontpanic345.tortoisespelling.data.ExampleSentence
import io.github.dontpanic345.tortoisespelling.data.Word
import io.github.dontpanic345.tortoisespelling.data.WordWithContent
import io.github.dontpanic345.tortoisespelling.data.normalizeWord
import io.github.dontpanic345.tortoisespelling.data.sorted
import kotlin.random.Random

/** What one review asks: a definition, the [form] to spell, and a sentence to blank it from. */
data class ReviewCard(
    val word: Word,
    val definition: String,
    val partOfSpeech: String?,
    val form: String,
    val label: String?,
    val example: ExampleSentence?,
) {
    val answer: String get() = normalizeWord(form)

    /** "verb · past tense", or null with neither. Blank parts count as absent. */
    val hint: String?
        get() = listOfNotNull(partOfSpeech, label)
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .joinToString(" · ")
            .takeIf { it.isNotEmpty() }
}

/**
 * The card for [content]: the example shown longest ago across every definition and form
 * (never shown first, [random] among ties), asking for that example's form. A word with no
 * examples asks for its base form with no sentence; one with no content at all asks for
 * its own text.
 */
fun pickCard(content: WordWithContent, random: Random = Random.Default): ReviewCard {
    val sorted = content.sorted()
    val candidates = sorted.definitions.flatMap { definition ->
        definition.forms.flatMap { form ->
            form.examples.map { example -> ReviewCard(
                word = sorted.word,
                definition = definition.definition.text,
                partOfSpeech = definition.definition.partOfSpeech,
                form = form.form.text,
                label = form.form.label,
                example = example,
            ) }
        }
    }
    if (candidates.isNotEmpty()) {
        val oldest = candidates.minOf { it.example?.shownAt ?: Long.MIN_VALUE }
        return candidates.filter { (it.example?.shownAt ?: Long.MIN_VALUE) == oldest }.random(random)
    }
    val definition = sorted.definitions.firstOrNull()
    val form = definition?.forms?.firstOrNull()
    return ReviewCard(
        word = sorted.word,
        definition = definition?.definition?.text.orEmpty(),
        partOfSpeech = definition?.definition?.partOfSpeech,
        form = form?.form?.text ?: sorted.word.text,
        label = form?.form?.label,
        example = null,
    )
}
