package io.github.dontpanic345.tortoisespelling.domain

/** SM-2 working state for one word. */
data class SrsState(
    val repetitions: Int,
    val easeFactor: Double,
    val intervalDays: Int,
)

/**
 * Kept behind an interface so FSRS can replace SM-2 later without the review UI
 * knowing anything changed.
 */
interface Scheduler {
    fun next(prev: SrsState, quality: Int): SrsState
}
