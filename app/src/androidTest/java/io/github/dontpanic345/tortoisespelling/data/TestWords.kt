package io.github.dontpanic345.tortoisespelling.data

import io.github.dontpanic345.tortoisespelling.domain.ReviewCard
import io.github.dontpanic345.tortoisespelling.domain.simpleContent

/** A [Word] with every field defaulted, so a test names only the ones it cares about. */
fun testWord(
    text: String,
    createdAt: Long = 0,
    repetitions: Int = 0,
    easeFactor: Double = 2.5,
    intervalDays: Int = 0,
    dueOn: Long = 0,
    lapses: Int = 0,
    lastReviewedAt: Long? = null,
    firstReviewedOn: Long? = null,
    isNew: Boolean = true,
    suspended: Boolean = false,
    autoRefresh: Boolean = false,
    refreshedOn: Long? = null,
): Word = Word(
    text = text,
    normalizedText = normalizeWord(text),
    createdAt = createdAt,
    repetitions = repetitions,
    easeFactor = easeFactor,
    intervalDays = intervalDays,
    dueOn = dueOn,
    lapses = lapses,
    lastReviewedAt = lastReviewedAt,
    firstReviewedOn = firstReviewedOn,
    isNew = isNew,
    suspended = suspended,
    autoRefresh = autoRefresh,
    refreshedOn = refreshedOn,
)

/** Give a word seeded straight through the DAO one definition, its base form and one example. */
suspend fun seedContent(
    dao: TortoiseSpellingDao,
    wordId: Long,
    definition: String = "A definition.",
    example: String = "",
    partOfSpeech: String? = null,
) {
    val text = dao.wordById(wordId)!!.text
    dao.insertContent(wordId, simpleContent(text, definition, partOfSpeech, example))
}

/** A review card for the root word alone, as a screen test wants to see one. */
fun testCard(
    text: String,
    definition: String = "A definition of $text.",
    example: String = "",
    partOfSpeech: String? = null,
    form: String = text,
    label: String? = null,
): ReviewCard = ReviewCard(
    word = testWord(text),
    definition = definition,
    partOfSpeech = partOfSpeech,
    form = form,
    label = label,
    example = example.takeIf { it.isNotBlank() }?.let { ExampleSentence(wordFormId = 0, text = it, orderIndex = 0) },
)
