package io.github.dontpanic345.tortoisespelling.domain

import io.github.dontpanic345.tortoisespelling.data.Grade
import io.github.dontpanic345.tortoisespelling.data.ReviewLog
import io.github.dontpanic345.tortoisespelling.data.Word

/** A word after one review, and the log row that records it. */
data class Reviewed(val word: Word, val log: ReviewLog)

/**
 * Apply one review to [word]. A first-try answer is [Grade.FIRST_TRY]; anything else is
 * [Grade.AFTER_RETYPE], which takes SM-2's lapse branch.
 */
fun reviewed(
    word: Word,
    correctFirstTry: Boolean,
    typedAnswer: String,
    today: Long,
    now: Long,
    fuzz: (today: Long, intervalDays: Int) -> Long,
    scheduler: Scheduler = Sm2Scheduler,
): Reviewed {
    val quality = if (correctFirstTry) Grade.FIRST_TRY else Grade.AFTER_RETYPE
    val next = scheduler.next(SrsState(word.repetitions, word.easeFactor, word.intervalDays), quality)
    return Reviewed(
        word = word.copy(
            repetitions = next.repetitions,
            easeFactor = next.easeFactor,
            intervalDays = next.intervalDays,
            dueOn = fuzz(today, next.intervalDays),
            lapses = word.lapses + if (quality < RESET_BELOW_QUALITY) 1 else 0,
            lastReviewedAt = now,
            firstReviewedOn = word.firstReviewedOn ?: today,
            isNew = false,
        ),
        log = ReviewLog(
            wordId = word.id,
            reviewedAt = now,
            reviewedOn = today,
            grade = quality,
            correct = correctFirstTry,
            typedAnswer = typedAnswer.trim(),
        ),
    )
}

/**
 * [current] with its scheduling put back to [before]'s, to take one review back. Content
 * and everything else ([Word.id], [Word.text], [Word.normalizedText], [Word.createdAt],
 * [Word.suspended]) come from [current], so an edit saved since is kept.
 */
fun undone(current: Word, before: Word): Word = current.copy(
    repetitions = before.repetitions,
    easeFactor = before.easeFactor,
    intervalDays = before.intervalDays,
    dueOn = before.dueOn,
    lapses = before.lapses,
    lastReviewedAt = before.lastReviewedAt,
    firstReviewedOn = before.firstReviewedOn,
    isNew = before.isNew,
)
