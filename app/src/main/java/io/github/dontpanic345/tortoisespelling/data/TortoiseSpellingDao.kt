package io.github.dontpanic345.tortoisespelling.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
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

    /**
     * Rewrite only a word's teaching content.
     *
     * Targeted rather than [updateWord] on a copy, because a card refresh runs in the
     * background while the user is reviewing: writing back a whole row built from the
     * session's opening snapshot would roll back the scheduling a review just wrote.
     */
    @Query(
        """
        UPDATE words
        SET definition = :definition, example = :example, partOfSpeech = :partOfSpeech
        WHERE id = :id
        """,
    )
    suspend fun updateContent(id: Long, definition: String, example: String, partOfSpeech: String?)

    /** Claim today's one refresh for a word, before making the call that may fail. */
    @Query("UPDATE words SET refreshedOn = :day WHERE id = :id")
    suspend fun markRefreshed(id: Long, day: Long)

    @Query("SELECT * FROM words WHERE normalizedText = :normalized LIMIT 1")
    suspend fun wordByNormalizedText(normalized: String): Word?

    @Query("SELECT * FROM words ORDER BY createdAt DESC")
    fun observeAllWords(): Flow<List<Word>>

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
}
