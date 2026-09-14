package io.github.dontpanic345.tortoisespelling.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * A word the user is learning to spell, plus its SM-2 scheduling state.
 *
 * [text] keeps the casing the user typed, so proper nouns display correctly.
 * [normalizedText] is the lowercased, trimmed form used for duplicate detection
 * and lookups; answers are always compared against it.
 */
@Entity(
    tableName = "words",
    indices = [
        Index(value = ["normalizedText"], unique = true),
        Index(value = ["dueOn"]),
        Index(value = ["firstReviewedOn"]),
    ],
)
data class Word(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val text: String,
    val normalizedText: String,
    val definition: String,
    val example: String,
    val partOfSpeech: String? = null,

    val createdAt: Long = System.currentTimeMillis(),

    // --- SM-2 state ---
    val repetitions: Int = 0,
    val easeFactor: Double = 2.5,
    val intervalDays: Int = 0,
    /** Epoch day, not millis. */
    val dueOn: Long,
    val lapses: Int = 0,
    val lastReviewedAt: Long? = null,
    /**
     * Epoch day the word was first ever reviewed, i.e. the day it stopped being new.
     * This is what the daily new-word allowance counts; counting "words reviewed
     * today" instead would let a big review day starve the allowance to zero.
     */
    val firstReviewedOn: Long? = null,
    val isNew: Boolean = true,
    val suspended: Boolean = false,
)

/** Lowercased, trimmed, internal-whitespace-collapsed form used for comparison. */
fun normalizeWord(raw: String): String = raw.trim().lowercase().replace(Regex("""\s+"""), " ")
