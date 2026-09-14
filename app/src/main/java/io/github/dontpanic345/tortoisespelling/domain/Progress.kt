package io.github.dontpanic345.tortoisespelling.domain

import io.github.dontpanic345.tortoisespelling.data.Word

/**
 * A word counts as known once its interval reaches three weeks, the point at which
 * spaced-repetition apps conventionally call a card "mature". It's a display
 * threshold only; scheduling doesn't look at it.
 */
const val KNOWN_INTERVAL_DAYS = 21

/** How far along the word list is, for Home's progress bar. Suspended words are left out. */
data class WordProgress(val new: Int, val learning: Int, val known: Int) {
    val total: Int get() = new + learning + known
}

/** Where an active (non-suspended) word sits between new and known. */
enum class LearningStage { NEW, LEARNING, KNOWN }

/** [null] for a suspended word: it isn't counted at any stage. */
fun learningStage(word: Word): LearningStage? = when {
    word.suspended -> null
    word.isNew -> LearningStage.NEW
    word.intervalDays >= KNOWN_INTERVAL_DAYS -> LearningStage.KNOWN
    else -> LearningStage.LEARNING
}

fun wordProgress(words: List<Word>): WordProgress {
    val stages = words.mapNotNull { learningStage(it) }
    return WordProgress(
        new = stages.count { it == LearningStage.NEW },
        learning = stages.count { it == LearningStage.LEARNING },
        known = stages.count { it == LearningStage.KNOWN },
    )
}

/**
 * The word list's filter chips. [DUE] overlaps [LEARNING] and [KNOWN] (a due word can be
 * either), which is fine because the chips are single-select rather than a partition.
 */
enum class WordFilter(val label: String) {
    ALL("All"),
    DUE("Due"),
    NEW("New"),
    LEARNING("Learning"),
    KNOWN("Known"),
    SUSPENDED("Suspended"),
}

fun WordFilter.matches(word: Word, today: Long): Boolean = when (this) {
    WordFilter.ALL -> true
    WordFilter.DUE -> !word.suspended && !word.isNew && word.dueOn <= today
    WordFilter.NEW -> learningStage(word) == LearningStage.NEW
    WordFilter.LEARNING -> learningStage(word) == LearningStage.LEARNING
    WordFilter.KNOWN -> learningStage(word) == LearningStage.KNOWN
    WordFilter.SUSPENDED -> word.suspended
}

/** Each filter's count over the whole list, for the chip labels. Ignores search. */
fun wordFilterCounts(words: List<Word>, today: Long): Map<WordFilter, Int> =
    WordFilter.entries.associateWith { filter -> words.count { filter.matches(it, today) } }

enum class DayMark {
    /** At least one review. */
    PRACTICED,

    /** Nothing was due, which bridges the streak (see [Days.currentStreak]). */
    NOTHING_DUE,

    /** Words were due and none were reviewed. */
    MISSED,

    /** Today, not practised yet. Still in progress, so not a miss. */
    PENDING,

    /** Before the first word was added, so there was nothing to miss. */
    BEFORE_START,
}

data class MarkedDay(val day: Long, val mark: DayMark)

/**
 * The [count] days ending today, oldest first, for Home's week strip. Uses the same
 * inputs as [Days.currentStreak], so the strip and the streak can't disagree.
 */
fun recentDays(
    today: Long,
    studyDays: Set<Long>,
    satisfiedDays: Set<Long>,
    firstDay: Long?,
    count: Int = 7,
): List<MarkedDay> = (today - count + 1..today).map { day ->
    val mark = when {
        day in studyDays -> DayMark.PRACTICED
        day in satisfiedDays -> DayMark.NOTHING_DUE
        day == today -> DayMark.PENDING
        firstDay == null || day < firstDay -> DayMark.BEFORE_START
        else -> DayMark.MISSED
    }
    MarkedDay(day, mark)
}

/** Home's greeting for an hour of the day, 0-23. */
fun greeting(hour: Int): String = when (hour) {
    in 5..11 -> "Good morning"
    in 12..17 -> "Good afternoon"
    else -> "Good evening"
}
