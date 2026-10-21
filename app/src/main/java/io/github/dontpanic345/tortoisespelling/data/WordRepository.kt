package io.github.dontpanic345.tortoisespelling.data

import io.github.dontpanic345.tortoisespelling.domain.Days
import io.github.dontpanic345.tortoisespelling.domain.DeviceClock
import io.github.dontpanic345.tortoisespelling.domain.MarkedDay
import io.github.dontpanic345.tortoisespelling.domain.ReviewCard
import io.github.dontpanic345.tortoisespelling.domain.Scheduler
import io.github.dontpanic345.tortoisespelling.domain.Sm2Scheduler
import io.github.dontpanic345.tortoisespelling.domain.WordContent
import io.github.dontpanic345.tortoisespelling.domain.WordProgress
import io.github.dontpanic345.tortoisespelling.domain.fuzzedDueDay
import io.github.dontpanic345.tortoisespelling.domain.interleaveSession
import io.github.dontpanic345.tortoisespelling.domain.preparedFor
import io.github.dontpanic345.tortoisespelling.domain.recentDays
import io.github.dontpanic345.tortoisespelling.domain.reviewed
import io.github.dontpanic345.tortoisespelling.domain.remainingNewToday
import io.github.dontpanic345.tortoisespelling.domain.pickCard
import io.github.dontpanic345.tortoisespelling.domain.simpleContent
import io.github.dontpanic345.tortoisespelling.domain.wordProgress
import kotlinx.coroutines.flow.Flow
import java.time.Clock

/** What today's session looks like before it starts. */
data class TodayPlan(val dueCount: Int, val newCount: Int) {
    val total: Int get() = dueCount + newCount
    val isClear: Boolean get() = total == 0
}

/** Outcome of trying to add a word. */
sealed interface AddResult {
    data class Added(val id: Long) : AddResult
    data class Duplicate(val existing: Word) : AddResult
    data object Blank : AddResult
}

/** Outcome of trying to save an edit. */
sealed interface UpdateResult {
    data object Updated : UpdateResult
    data class Duplicate(val existing: Word) : UpdateResult
}

class WordRepository(
    private val dao: TortoiseSpellingDao,
    private val settings: SettingsStore,
    private val clock: Clock = DeviceClock,
    private val fuzz: (today: Long, intervalDays: Int) -> Long = ::fuzzedDueDay,
    private val scheduler: Scheduler = Sm2Scheduler,
) {

    fun observeWordsWithContent(): Flow<List<WordWithContent>> = dao.observeWordsWithContent()

    suspend fun wordCount(): Int = dao.wordCount()

    suspend fun wordById(id: Long): Word? = dao.wordById(id)

    suspend fun contentById(id: Long): WordWithContent? = dao.contentById(id)?.sorted()

    suspend fun addWord(text: String, content: WordContent): AddResult {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) {
            return AddResult.Blank
        }
        val normalized = normalizeWord(trimmed)
        dao.wordByNormalizedText(normalized)?.let { return AddResult.Duplicate(it) }

        val id = dao.insertWordWithContent(
            Word(
                text = trimmed,
                normalizedText = normalized,
                dueOn = Days.today(clock),
            ),
            content.preparedFor(trimmed),
        )
        return AddResult.Added(id)
    }

    suspend fun addWord(
        text: String,
        definition: String,
        example: String,
        partOfSpeech: String?,
    ): AddResult = addWord(text, simpleContent(text.trim(), definition, partOfSpeech, example))

    /** Save an edit: the word row, with [content] replacing its tree. Scheduling is kept. */
    suspend fun updateWord(word: Word, content: WordContent): UpdateResult {
        val trimmed = word.text.trim()
        val normalized = normalizeWord(trimmed)
        // Renaming a word onto one that already exists would otherwise violate the
        // unique index and take the app down with it.
        dao.wordByNormalizedText(normalized)?.let { clash ->
            if (clash.id != word.id) {
                return UpdateResult.Duplicate(clash)
            }
        }
        dao.updateWordWithContent(
            word.copy(text = trimmed, normalizedText = normalized),
            content.preparedFor(trimmed),
        )
        return UpdateResult.Updated
    }

    suspend fun deleteWord(word: Word) = dao.deleteWord(word)

    suspend fun setSuspended(word: Word, suspended: Boolean) =
        dao.updateWord(word.copy(suspended = suspended))

    // --- today ---

    suspend fun todayPlan(): TodayPlan {
        val today = Days.today(clock)
        val allowance = remainingNewToday(
            newWordsPerDay = settings.current().newWordsPerDay,
            introducedToday = dao.introducedOn(today),
        )
        return TodayPlan(
            dueCount = dao.dueCount(today),
            newCount = minOf(allowance, dao.availableNewCount()),
        )
    }

    /** Due words plus today's new allowance, lightly interleaved. */
    suspend fun buildSession(): List<ReviewCard> {
        val today = Days.today(clock)
        val due = dao.dueWords(today)
        val allowance = remainingNewToday(
            newWordsPerDay = settings.current().newWordsPerDay,
            introducedToday = dao.introducedOn(today),
        )
        val fresh = if (allowance > 0) dao.newWords(allowance) else emptyList()
        return cardsFor(interleaveSession(due, fresh))
    }

    /** Free practice. Never touches scheduling or the review log, by design. */
    suspend fun practicePool(limit: Int = 10): List<ReviewCard> = cardsFor(dao.randomWords(limit))

    /** Stamps [example] as shown now, so the next pick for its word rotates to another. */
    suspend fun markShown(example: ExampleSentence) = dao.markShown(example.id, clock.millis())

    /** One card per word (its least recently shown example), in the words' order. */
    /** The card [cardsFor] would pick for one word, from its content now; null if it's gone. */
    suspend fun cardFor(wordId: Long): ReviewCard? = dao.contentById(wordId)?.let(::pickCard)

    private suspend fun cardsFor(words: List<Word>): List<ReviewCard> {
        val content = dao.contentFor(words.map { it.id }).associateBy { it.word.id }
        return words.map { word -> pickCard(content[word.id] ?: WordWithContent(word, emptyList())) }
    }

    /**
     * Apply SM-2 and log the review, in one transaction.
     *
     * A missed word is not re-queued into this session: the mandatory retype is the
     * corrective repetition, and an open-ended session undermines the clear stopping
     * point the whole app is built around.
     *
     * Returns what [undoReview] needs to take it back, or null if the word is gone.
     */
    suspend fun recordReview(wordId: Long, correctFirstTry: Boolean, typedAnswer: String): ReviewUndo? {
        val today = Days.today(clock)
        val now = clock.millis()
        // A word deleted mid-session records nothing.
        return dao.recordReview(wordId) { reviewed(it, correctFirstTry, typedAnswer, today, now, fuzz, scheduler) }
    }

    /**
     * Take back the review [recordReview] returned [undo] for. Content is untouched; a
     * deleted word records nothing.
     */
    suspend fun undoReview(undo: ReviewUndo) {
        dao.undoReview(undo)
    }

    suspend fun reviewedToday(): Int = dao.reviewedCountOn(Days.today(clock))

    suspend fun currentStreak(): Int = Days.currentStreak(
        studyDays = dao.recentStudyDays(STREAK_WINDOW_DAYS).toSet(),
        today = Days.today(clock),
        satisfiedDays = settings.satisfiedDays(),
    )

    /** The last week, day by day, for Home's week strip. */
    suspend fun lastWeek(): List<MarkedDay> = recentDays(
        today = Days.today(clock),
        studyDays = dao.recentStudyDays(WEEK_DAYS).toSet(),
        satisfiedDays = settings.satisfiedDays(),
        firstDay = dao.firstCreatedAt()?.let { Days.dayOf(it, clock.zone) },
        count = WEEK_DAYS,
    )

    suspend fun progress(): WordProgress = wordProgress(dao.allWordsOnce())

    /** Epoch day of the next scheduled review, or null if nothing is scheduled. */
    suspend fun nextDueDay(): Long? = dao.nextDueDay()

    /** Record that today had nothing due, so it bridges rather than breaks the streak. */
    fun markTodaySatisfied() = settings.markSatisfied(Days.today(clock))

    // --- backup ---

    suspend fun exportAll(): List<WordWithContent> = dao.allContentOnce()

    /**
     * Merge an imported list in. Words already present keep their local scheduling
     * state — a backup should never quietly undo progress made since it was taken.
     */
    suspend fun importWords(words: List<ImportedWord>): ImportSummary {
        var added = 0
        var skipped = 0
        for (incoming in words) {
            val normalized = normalizeWord(incoming.word.text)
            if (normalized.isEmpty() || dao.wordByNormalizedText(normalized) != null) {
                skipped++
                continue
            }
            dao.insertWordWithContent(
                incoming.word.copy(id = 0, normalizedText = normalized),
                incoming.content.preparedFor(incoming.word.text),
            )
            added++
        }
        return ImportSummary(added = added, skipped = skipped)
    }

    private companion object {
        const val STREAK_WINDOW_DAYS = 400
        const val WEEK_DAYS = 7
    }
}

data class ImportSummary(val added: Int, val skipped: Int)

/** A word read from a backup, with its teaching content. */
data class ImportedWord(val word: Word, val content: WordContent)
