package io.github.dontpanic345.tortoisespelling.data

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/** A spelling of a word under one [Definition]: the word itself, "ran", "children". */
@Entity(
    tableName = "word_forms",
    foreignKeys = [
        ForeignKey(
            entity = Definition::class,
            parentColumns = ["id"],
            childColumns = ["definitionId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index(value = ["definitionId"])],
)
data class WordForm(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val definitionId: Long,
    /** The spelling asked for. Needn't share a letter with the root ("ran"). */
    val text: String,
    /** "past tense", "plural": whatever the user or the lookup wrote. Null for none. */
    val label: String? = null,
    val orderIndex: Int,
)
