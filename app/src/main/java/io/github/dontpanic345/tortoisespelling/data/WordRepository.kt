package io.github.dontpanic345.tortoisespelling.data

import io.github.dontpanic345.tortoisespelling.domain.Days
import io.github.dontpanic345.tortoisespelling.domain.MarkedDay
import io.github.dontpanic345.tortoisespelling.domain.Scheduler
import io.github.dontpanic345.tortoisespelling.domain.Sm2Scheduler
import io.github.dontpanic345.tortoisespelling.domain.SrsState
import io.github.dontpanic345.tortoisespelling.domain.WordProgress
import io.github.dontpanic345.tortoisespelling.domain.fuzzedDueDay
import io.github.dontpanic345.tortoisespelling.domain.hideWordInDefinition
import io.github.dontpanic345.tortoisespelling.domain.interleaveSession
import io.github.dontpanic345.tortoisespelling.domain.recentDays
import io.github.dontpanic345.tortoisespelling.domain.remainingNewToday
import io.github.dontpanic345.tortoisespelling.domain.wordProgress
import kotlinx.coroutines.flow.Flow

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
    private val scheduler: Scheduler = Sm2Scheduler,
) {

    fun observeWords(): Flow<List<Word>> = dao.observeAllWords()

    fun observeWordCount(): Flow<Int> = dao.observeWordCount()

    fun observeReviewedToday(): Flow<Int> = dao.observeReviewedCountOn(Days.today())

    suspend fun wordById(id: Long): Word? = dao.wordById(id)

    suspend fun addWord(
        text: String,
        definition: String,
        example: String,
        partOfSpeech: String?,
    ): AddResult {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) {
            return AddResult.Blank
        }
        val normalized = normalizeWord(trimmed)
        dao.wordByNormalizedText(normalized)?.let { return AddResult.Duplicate(it) }

        val id = dao.insertWord(
            Word(
                text = trimmed,
                normalizedText = normalized,
                definition = hideWordInDefinition(definition.trim(), trimmed),
                example = example.trim(),
                partOfSpeech = partOfSpeech?.trim()?.ifBlank { null },
                dueOn = Days.today(),
            ),
        )
        return AddResult.Added(id)
    }

    suspend fun updateWord(word: Word): UpdateResult {
        val trimmed = word.text.trim()
        val normalized = normalizeWord(trimmed)
        // Renaming a word onto one that already exists would otherwise violate the
        // unique index and take the app down with it.
        dao.wordByNormalizedText(normalized)?.let { clash ->
            if (clash.id != word.id) {
                return UpdateResult.Duplicate(clash)
            }
        }
        dao.updateWord(
            word.copy(
                text = trimmed,
                normalizedText = normalized,
                definition = hideWordInDefinition(word.definition.trim(), trimmed),
            ),
        )
        return UpdateResult.Updated
    }

    suspend fun deleteWord(word: Word) = dao.deleteWord(word)

    suspend fun setSuspended(word: Word, suspended: Boolean) =
        dao.updateWord(word.copy(suspended = suspended))

    // --- today ---

    suspend fun todayPlan(): TodayPlan {
        val today = Days.today()
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
    suspend fun buildSession(): List<Word> {
        val today = Days.today()
        val due = dao.dueWords(today)
        val allowance = remainingNewToday(
            newWordsPerDay = settings.current().newWordsPerDay,
            introducedToday = dao.introducedOn(today),
        )
        val fresh = if (allowance > 0) dao.newWords(allowance) else emptyList()
        return interleaveSession(due, fresh)
    }

    /** Free practice. Never touches scheduling or the review log, by design. */
    suspend fun practicePool(limit: Int = 10): List<Word> = dao.randomWords(limit)

    /**
     * Apply SM-2 and log the review.
     *
     * A missed word is not re-queued into this session: the mandatory retype is the
     * corrective repetition, and an open-ended session undermines the clear stopping
     * point the whole app is built around.
     */
    suspend fun recordReview(word: Word, correctFirstTry: Boolean, typedAnswer: String) {
        val today = Days.today()
        val quality = if (correctFirstTry) Grade.FIRST_TRY else Grade.AFTER_RETYPE
        val next = scheduler.next(
            SrsState(word.repetitions, word.easeFactor, word.intervalDays),
            quality,
        )
        dao.updateWord(
            word.copy(
                repetitions = next.repetitions,
                easeFactor = next.easeFactor,
                intervalDays = next.intervalDays,
                dueOn = fuzzedDueDay(today, next.intervalDays),
                lapses = word.lapses + if (quality < 3) 1 else 0,
                lastReviewedAt = System.currentTimeMillis(),
                firstReviewedOn = word.firstReviewedOn ?: today,
                isNew = false,
            ),
        )
        dao.insertLog(
            ReviewLog(
                wordId = word.id,
                reviewedAt = System.currentTimeMillis(),
                reviewedOn = today,
                grade = quality,
                correct = correctFirstTry,
                typedAnswer = typedAnswer.trim(),
            ),
        )
    }

    suspend fun reviewedToday(): Int = dao.reviewedCountOn(Days.today())

    suspend fun currentStreak(): Int = Days.currentStreak(
        studyDays = dao.recentStudyDays(STREAK_WINDOW_DAYS).toSet(),
        today = Days.today(),
        satisfiedDays = settings.satisfiedDays(),
    )

    /** The last week, day by day, for Home's week strip. */
    suspend fun lastWeek(): List<MarkedDay> = recentDays(
        today = Days.today(),
        studyDays = dao.recentStudyDays(WEEK_DAYS).toSet(),
        satisfiedDays = settings.satisfiedDays(),
        firstDay = dao.firstCreatedAt()?.let { Days.dayOf(it) },
        count = WEEK_DAYS,
    )

    suspend fun progress(): WordProgress = wordProgress(dao.allWordsOnce())

    /** Epoch day of the next scheduled review, or null if nothing is scheduled. */
    suspend fun nextDueDay(): Long? = dao.nextDueDay()

    /** Record that today had nothing due, so it bridges rather than breaks the streak. */
    fun markTodaySatisfied() = settings.markSatisfied(Days.today())

    // --- backup ---

    suspend fun exportAll(): List<Word> = dao.allWordsOnce()

    /**
     * Merge an imported list in. Words already present keep their local scheduling
     * state — a backup should never quietly undo progress made since it was taken.
     */
    suspend fun importWords(words: List<Word>): ImportSummary {
        var added = 0
        var skipped = 0
        for (incoming in words) {
            val normalized = normalizeWord(incoming.text)
            if (normalized.isEmpty() || dao.wordByNormalizedText(normalized) != null) {
                skipped++
                continue
            }
            dao.insertWord(incoming.copy(id = 0, normalizedText = normalized))
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
