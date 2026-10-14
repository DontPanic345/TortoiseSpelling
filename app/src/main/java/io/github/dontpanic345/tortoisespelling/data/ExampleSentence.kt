package io.github.dontpanic345.tortoisespelling.data

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/** A sentence using one [WordForm], with the form blanked out during review. */
@Entity(
    tableName = "example_sentences",
    foreignKeys = [
        ForeignKey(
            entity = WordForm::class,
            parentColumns = ["id"],
            childColumns = ["wordFormId"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index(value = ["wordFormId"])],
)
data class ExampleSentence(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val wordFormId: Long,
    val text: String,
    val orderIndex: Int,
    /** Millis the sentence was last shown in review, or null if never. */
    val shownAt: Long? = null,
)
