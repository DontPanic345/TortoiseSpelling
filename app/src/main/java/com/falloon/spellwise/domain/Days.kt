package com.falloon.spellwise.domain

import java.time.LocalDate

/**
 * Day arithmetic for scheduling. Days roll over at local midnight — a session at
 * 00:30 counts as a new day.
 */
object Days {
    fun today(): Long = LocalDate.now().toEpochDay()

    fun plus(day: Long, days: Long): Long = day + days

    /** "today", "tomorrow", "in 5 days", "3 days ago". */
    fun relativeLabel(day: Long, today: Long = today()): String = when (val delta = day - today) {
        0L -> "today"
        1L -> "tomorrow"
        -1L -> "yesterday"
        in 2L..Long.MAX_VALUE -> "in $delta days"
        else -> "${-delta} days ago"
    }

    /**
     * Length of the run of consecutive study days ending today or yesterday.
     *
     * [studyDays] is the set of days with at least one review, and [satisfiedDays]
     * are days that had nothing due — those bridge a gap rather than breaking it,
     * so a quiet week does not cost the user their streak.
     */
    fun currentStreak(
        studyDays: Set<Long>,
        today: Long = today(),
        satisfiedDays: Set<Long> = emptySet(),
    ): Int {
        if (studyDays.isEmpty()) {
            return 0
        }
        // A streak may end today or yesterday: today is still in progress.
        var cursor = if (today in studyDays) today else today - 1
        if (cursor !in studyDays) {
            return 0
        }
        var streak = 0
        while (true) {
            when (cursor) {
                in studyDays -> streak++
                in satisfiedDays -> Unit // nothing was due; the streak carries over
                else -> return streak
            }
            cursor--
        }
    }
}
