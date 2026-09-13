package com.falloon.tortoisespelling.domain

import com.falloon.tortoisespelling.data.Word

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

fun wordProgress(words: List<Word>): WordProgress {
    val active = words.filterNot { it.suspended }
    val new = active.count { it.isNew }
    val known = active.count { !it.isNew && it.intervalDays >= KNOWN_INTERVAL_DAYS }
    return WordProgress(new = new, learning = active.size - new - known, known = known)
}

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
