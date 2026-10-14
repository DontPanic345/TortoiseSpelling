package io.github.dontpanic345.tortoisespelling.data

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * One sense of a [Word]: what the review shows as the prompt.
 *
 * A word's first definition (lowest [orderIndex]) owns its base form, the word's own
 * spelling. The part of speech sits here rather than on the form, since a sense has
 * one.
 */
@Entity(
    tableName = "definitions",
    foreignKeys = [
        ForeignKey(
            entity = Word::class,
            parentColumns = ["id"],
            childColumns = ["wordId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index(value = ["wordId"])],
)
data class Definition(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val wordId: Long,
    val text: String,
    val partOfSpeech: String? = null,
    val orderIndex: Int,
)
