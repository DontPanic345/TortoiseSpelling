package com.falloon.spellwise.data

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/** One row per word per review session. */
@Entity(
    tableName = "review_log",
    foreignKeys = [
        ForeignKey(
            entity = Word::class,
            parentColumns = ["id"],
            childColumns = ["wordId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index(value = ["wordId"]), Index(value = ["reviewedOn"])],
)
data class ReviewLog(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val wordId: Long,
    /** Millis. */
    val reviewedAt: Long,
    /** Epoch day, for streak and stats queries. */
    val reviewedOn: Long,
    /** See [Grade]. */
    val grade: Int,
    val correct: Boolean,
    val typedAnswer: String,
)

/**
 * SM-2 quality values as this app uses them.
 *
 * Only [FIRST_TRY] avoids the lapse branch. [AFTER_RETYPE] is deliberately 2, not 3:
 * SM-2 resets on `quality < 3`, and a word the user could not produce unaided should
 * come back tomorrow.
 */
object Grade {
    /** Correct on the first attempt. */
    const val FIRST_TRY = 5

    /** Wrong, then retyped correctly after being shown the answer. */
    const val AFTER_RETYPE = 2

    /** Wrong and gave up. Reserved — the retype is currently mandatory. */
    const val GAVE_UP = 0
}
