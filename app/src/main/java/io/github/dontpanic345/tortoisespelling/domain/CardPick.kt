package io.github.dontpanic345.tortoisespelling.domain

import io.github.dontpanic345.tortoisespelling.data.ExampleSentence
import io.github.dontpanic345.tortoisespelling.data.Word
import io.github.dontpanic345.tortoisespelling.data.WordWithContent
import io.github.dontpanic345.tortoisespelling.data.normalizeWord
import io.github.dontpanic345.tortoisespelling.data.sorted

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
}

/** The card for the root word alone: its first definition, base form and first example. */
fun rootCard(content: WordWithContent): ReviewCard {
    val definition = content.sorted().definitions.firstOrNull()
    val form = definition?.forms?.firstOrNull()
    return ReviewCard(
        word = content.word,
        definition = definition?.definition?.text.orEmpty(),
        partOfSpeech = definition?.definition?.partOfSpeech,
        form = form?.form?.text ?: content.word.text,
        label = form?.form?.label,
        example = form?.examples?.firstOrNull(),
    )
}
