package com.falloon.tortoisespelling.domain

import kotlin.math.roundToInt
import kotlin.random.Random

/** Intervals stop growing here; a spelling this cold is worth re-checking yearly. */
const val MAX_INTERVAL_DAYS = 365

/** Starting state for a word that has never been reviewed. */
val NewWordState = SrsState(repetitions = 0, easeFactor = 2.5, intervalDays = 0)

/**
 * SM-2 (SuperMemo 2).
 *
 * Quality values this app produces are in [com.falloon.tortoisespelling.data.Grade]:
 * 5 for correct first try, 2 for correct only after being shown the answer.
 * Anything below 3 resets the repetition count and brings the word back tomorrow.
 */
object Sm2Scheduler : Scheduler {

    override fun next(prev: SrsState, quality: Int): SrsState {
        // The ease factor moves on every review, including lapses.
        val ease = (
            prev.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
            ).coerceAtLeast(1.3)

        if (quality < 3) {
            return SrsState(repetitions = 0, easeFactor = ease, intervalDays = 1)
        }

        val repetitions = prev.repetitions + 1
        val interval = when (repetitions) {
            1 -> 1
            2 -> 6
            else -> (prev.intervalDays * ease).roundToInt().coerceAtLeast(1)
        }
        return SrsState(
            repetitions = repetitions,
            easeFactor = ease,
            intervalDays = interval.coerceAtMost(MAX_INTERVAL_DAYS),
        )
    }
}

/**
 * Due day for [intervalDays] from [today], with a little spread.
 *
 * Without this, every word added on the same day and answered the same way stays
 * clumped on the same due dates forever, producing empty days next to huge ones.
 * Short intervals are left alone — fuzzing "tomorrow" would just be noise.
 */
fun fuzzedDueDay(today: Long, intervalDays: Int, random: Random = Random.Default): Long {
    val spread = when {
        intervalDays <= 2 -> 0
        intervalDays <= 7 -> 1
        else -> (intervalDays * 0.05).roundToInt().coerceAtLeast(1)
    }
    val offset = if (spread == 0) 0 else random.nextInt(-spread, spread + 1)
    val interval = (intervalDays + offset).coerceIn(1, MAX_INTERVAL_DAYS)
    return today + interval
}
