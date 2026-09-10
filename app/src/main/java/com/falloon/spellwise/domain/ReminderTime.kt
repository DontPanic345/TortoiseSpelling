package com.falloon.spellwise.domain

import java.time.Duration
import java.time.LocalDateTime

/**
 * Milliseconds from [now] until the next occurrence of [hour]:[minute].
 *
 * Always strictly in the future: if the time has already passed today (or is exactly
 * now), it targets tomorrow.
 */
fun millisUntilNext(hour: Int, minute: Int, now: LocalDateTime = LocalDateTime.now()): Long {
    val todayAtTime = now.toLocalDate().atTime(hour, minute)
    val target = if (todayAtTime.isAfter(now)) todayAtTime else todayAtTime.plusDays(1)
    return Duration.between(now, target).toMillis()
}
