package io.github.dontpanic345.tortoisespelling.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update
import io.github.dontpanic345.tortoisespelling.domain.WordContent
import kotlinx.coroutines.flow.Flow

@Dao
interface TortoiseSpellingDao {

    // --- words ---

    @Insert
    suspend fun insertWord(word: Word): Long

    @Update
    suspend fun updateWord(word: Word)

    @Delete
    suspend fun deleteWord(word: Word)

    @Query("SELECT * FROM words WHERE id = :id")
    suspend fun wordById(id: Long): Word?

    /** Claim today's one refresh for a word, before making the call that may fail. */
    @Query("UPDATE words SET refreshedOn = :day WHERE id = :id")
    suspend fun markRefreshed(id: Long, day: Long)

    @Query("SELECT * FROM words WHERE normalizedText = :normalized LIMIT 1")
    suspend fun wordByNormalizedText(normalized: String): Word?

    @Query("SELECT COUNT(*) FROM words")
    suspend fun wordCount(): Int

    @Query("SELECT * FROM words ORDER BY createdAt")
    suspend fun allWordsOnce(): List<Word>

    /** When the oldest word was added (millis), or null with no words. */
    @Query("SELECT MIN(createdAt) FROM words")
    suspend fun firstCreatedAt(): Long?

    /** Words already in rotation and due on or before [today]. */
    @Query(
        """
        SELECT * FROM words
        WHERE suspended = 0 AND isNew = 0 AND dueOn <= :today
        ORDER BY dueOn
        """,
    )
    suspend fun dueWords(today: Long): List<Word>

    @Query(
        """
        SELECT COUNT(*) FROM words
        WHERE suspended = 0 AND isNew = 0 AND dueOn <= :today
        """,
    )
    suspend fun dueCount(today: Long): Int

    /** Never-reviewed words, oldest first, capped at the remaining daily allowance. */
    @Query(
        """
        SELECT * FROM words
        WHERE suspended = 0 AND isNew = 1
        ORDER BY createdAt
        LIMIT :limit
        """,
    )
    suspend fun newWords(limit: Int): List<Word>

    @Query("SELECT COUNT(*) FROM words WHERE suspended = 0 AND isNew = 1")
    suspend fun availableNewCount(): Int

    /** How many words were introduced (first ever reviewed) on [day]. */
    @Query("SELECT COUNT(*) FROM words WHERE firstReviewedOn = :day")
    suspend fun introducedOn(day: Long): Int

    /** Soonest upcoming due day among scheduled words, or null if there are none. */
    @Query("SELECT MIN(dueOn) FROM words WHERE suspended = 0 AND isNew = 0")
    suspend fun nextDueDay(): Long?

    /** Random pool for free practice, which never touches scheduling. */
    @Query("SELECT * FROM words WHERE suspended = 0 ORDER BY RANDOM() LIMIT :limit")
    suspend fun randomWords(limit: Int): List<Word>

    // --- teaching content ---

    @Insert
    suspend fun insertDefinition(definition: Definition): Long

    @Insert
    suspend fun insertForm(form: WordForm): Long

    @Insert
    suspend fun insertExample(example: ExampleSentence): Long

    /** Forms and examples go with the definitions, by cascade. */
    @Query("DELETE FROM definitions WHERE wordId = :wordId")
    suspend fun deleteContent(wordId: Long)

    /** Store a prepared [content] tree under [wordId], `orderIndex` being list position. */
    @Transaction
    suspend fun insertContent(wordId: Long, content: WordContent) {
        content.definitions.forEachIndexed { d, definition ->
            val definitionId = insertDefinition(
                Definition(
                    wordId = wordId,
                    text = definition.text,
                    partOfSpeech = definition.partOfSpeech.ifBlank { null },
                    orderIndex = d,
                ),
            )
            definition.forms.forEachIndexed { f, form ->
                val formId = insertForm(
                    WordForm(
                        definitionId = definitionId,
                        text = form.text,
                        label = form.label.ifBlank { null },
                        orderIndex = f,
                    ),
                )
                form.examples.forEachIndexed { e, example ->
                    insertExample(
                        ExampleSentence(
                            wordFormId = formId,
                            text = example.text,
                            orderIndex = e,
                            shownAt = example.shownAt,
                        ),
                    )
                }
            }
        }
    }

    @Transaction
    suspend fun insertWordWithContent(word: Word, content: WordContent): Long {
        val id = insertWord(word)
        insertContent(id, content)
        return id
    }

    /** Write the word row and replace its whole tree; its review log is untouched. */
    @Transaction
    suspend fun updateWordWithContent(word: Word, content: WordContent) {
        updateWord(word)
        deleteContent(word.id)
        insertContent(word.id, content)
    }

    @Transaction
    @Query("SELECT * FROM words WHERE id = :id")
    suspend fun contentById(id: Long): WordWithContent?

    /** Chunked below SQLite's 999-variable limit on API 26; the order is unspecified. */
    @Transaction
    suspend fun contentFor(ids: List<Long>): List<WordWithContent> =
        ids.chunked(CONTENT_CHUNK).flatMap { contentForChunk(it) }

    @Transaction
    @Query("SELECT * FROM words WHERE id IN (:ids)")
    suspend fun contentForChunk(ids: List<Long>): List<WordWithContent>

    @Transaction
    @Query("SELECT * FROM words ORDER BY createdAt DESC")
    fun observeWordsWithContent(): Flow<List<WordWithContent>>

    @Transaction
    @Query("SELECT * FROM words ORDER BY createdAt")
    suspend fun allContentOnce(): List<WordWithContent>

    @Query("UPDATE example_sentences SET shownAt = :at WHERE id = :id")
    suspend fun markShown(id: Long, at: Long)

    /** The `orderIndex` that appends to a form's examples. */
    @Query("SELECT COALESCE(MAX(orderIndex) + 1, 0) FROM example_sentences WHERE wordFormId = :formId")
    suspend fun nextExampleIndex(formId: Long): Int

    // --- review log ---

    @Insert
    suspend fun insertLog(log: ReviewLog): Long

    @Query("SELECT COUNT(DISTINCT wordId) FROM review_log WHERE reviewedOn = :day")
    suspend fun reviewedCountOn(day: Long): Int

    /** Distinct days with at least one review, most recent first. */
    @Query("SELECT DISTINCT reviewedOn FROM review_log ORDER BY reviewedOn DESC LIMIT :limit")
    suspend fun recentStudyDays(limit: Int): List<Long>

    @Query("DELETE FROM review_log")
    suspend fun clearLogs()

    @Query("DELETE FROM words")
    suspend fun clearWords()

    private companion object {
        const val CONTENT_CHUNK = 500
    }
}
