package io.github.dontpanic345.tortoisespelling.domain

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * Day arithmetic for scheduling. Days roll over at local midnight — a session at
 * 00:30 counts as a new day.
 */
object Days {
    fun today(): Long = LocalDate.now().toEpochDay()

    fun plus(day: Long, days: Long): Long = day + days

    /** The local day a millisecond timestamp falls on. */
    fun dayOf(millis: Long, zone: ZoneId = ZoneId.systemDefault()): Long =
        Instant.ofEpochMilli(millis).atZone(zone).toLocalDate().toEpochDay()

    /** "today", "tomorrow", "in 5 days", "3 days ago". */
    fun relativeLabel(day: Long, today: Long = today()): String = when (val delta = day - today) {
        0L -> "today"
        1L -> "tomorrow"
        -1L -> "yesterday"
        in 2L..Long.MAX_VALUE -> "in $delta days"
        else -> "${-delta} days ago"
    }

    /**
     * Number of study days in the unbroken run ending today.
     *
     * [studyDays] is the set of days with at least one review, and [satisfiedDays]
     * are days that had nothing due — those bridge a gap rather than breaking it,
     * so a quiet week does not cost the user their streak. Today is still in progress,
     * so not having studied yet does not break the run either.
     */
    fun currentStreak(
        studyDays: Set<Long>,
        today: Long = today(),
        satisfiedDays: Set<Long> = emptySet(),
    ): Int {
        if (studyDays.isEmpty()) {
            return 0
        }
        // No early exit when yesterday is not a study day: it may be a satisfied day
        // bridging back to one, and the walk below already stops at a real gap.
        var cursor = if (today in studyDays) today else today - 1
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
