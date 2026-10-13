package io.github.dontpanic345.tortoisespelling.data

import android.database.sqlite.SQLiteConstraintException
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class TortoiseSpellingDaoTest {

    private lateinit var db: TortoiseSpellingDatabase
    private lateinit var dao: TortoiseSpellingDao

    @Before
    fun open() {
        db = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext(),
            TortoiseSpellingDatabase::class.java,
        ).build()
        dao = db.dao()
    }

    @After
    fun close() {
        db.close()
    }

    private fun log(wordId: Long, day: Long) = ReviewLog(
        wordId = wordId,
        reviewedAt = day * 1000,
        reviewedOn = day,
        grade = Grade.FIRST_TRY,
        correct = true,
        typedAnswer = "x",
    )

    @Test
    fun duplicateNormalizedTextIsRefused() = runTest {
        dao.insertWord(testWord("Necessary"))
        assertThrows(SQLiteConstraintException::class.java) {
            kotlinx.coroutines.runBlocking { dao.insertWord(testWord("necessary")) }
        }
    }

    @Test
    fun wordByIdAndNormalizedTextFindOrReturnNull() = runTest {
        val id = dao.insertWord(testWord("Café"))
        assertEquals("Café", dao.wordById(id)?.text)
        assertNull(dao.wordById(id + 1))
        assertEquals(id, dao.wordByNormalizedText("café")?.id)
        assertNull(dao.wordByNormalizedText("tea"))
    }

    @Test
    fun dueWordsIncludeOverdueAndTodayInDueOrder() = runTest {
        dao.insertWord(testWord("today", isNew = false, dueOn = 10))
        dao.insertWord(testWord("overdue", isNew = false, dueOn = 7))
        dao.insertWord(testWord("tomorrow", isNew = false, dueOn = 11))
        dao.insertWord(testWord("fresh", isNew = true, dueOn = 5))
        dao.insertWord(testWord("paused", isNew = false, dueOn = 5, suspended = true))

        assertEquals(listOf("overdue", "today"), dao.dueWords(10).map { it.text })
        assertEquals(2, dao.dueCount(10))
    }

    @Test
    fun newWordsAreUnsuspendedOldestFirstAndLimited() = runTest {
        dao.insertWord(testWord("second", createdAt = 2))
        dao.insertWord(testWord("first", createdAt = 1))
        dao.insertWord(testWord("third", createdAt = 3))
        dao.insertWord(testWord("paused", createdAt = 0, suspended = true))
        dao.insertWord(testWord("seen", createdAt = 0, isNew = false))

        assertEquals(listOf("first", "second", "third"), dao.newWords(10).map { it.text })
        assertEquals(listOf("first", "second"), dao.newWords(2).map { it.text })
        assertEquals(3, dao.availableNewCount())
    }

    @Test
    fun introducedOnCountsFirstReviewDayNotReviews() = runTest {
        val a = dao.insertWord(testWord("a", isNew = false, firstReviewedOn = 10))
        dao.insertWord(testWord("b", isNew = false, firstReviewedOn = 10))
        dao.insertWord(testWord("c", isNew = false, firstReviewedOn = 9))
        dao.insertWord(testWord("d"))
        dao.insertLog(log(a, 10))
        dao.insertLog(log(a, 11))

        assertEquals(2, dao.introducedOn(10))
        assertEquals(0, dao.introducedOn(11))
    }

    @Test
    fun nextDueDayIsTheMinimumOverScheduledUnsuspendedWords() = runTest {
        assertNull(dao.nextDueDay())
        dao.insertWord(testWord("later", isNew = false, dueOn = 20))
        dao.insertWord(testWord("sooner", isNew = false, dueOn = 12))
        dao.insertWord(testWord("paused", isNew = false, dueOn = 3, suspended = true))
        dao.insertWord(testWord("fresh", dueOn = 1))

        assertEquals(12L, dao.nextDueDay())
    }

    @Test
    fun randomWordsSkipSuspendedAndRespectLimit() = runTest {
        repeat(5) { dao.insertWord(testWord("w$it")) }
        dao.insertWord(testWord("paused", suspended = true))

        repeat(10) {
            val pool = dao.randomWords(3)
            assertEquals(3, pool.size)
            assertTrue(pool.none { it.suspended })
        }
        assertEquals(5, dao.randomWords(50).size)
    }

    @Test
    fun observeAllWordsIsNewestFirstAndEmitsAfterInsert() = runTest {
        dao.insertWord(testWord("old", createdAt = 1))
        dao.insertWord(testWord("new", createdAt = 2))
        assertEquals(listOf("new", "old"), dao.observeAllWords().first().map { it.text })

        dao.insertWord(testWord("newest", createdAt = 3))
        assertEquals(
            listOf("newest", "new", "old"),
            dao.observeAllWords().first().map { it.text },
        )
    }

    @Test
    fun allWordsFirstCreatedAtAndCountWhenEmpty() = runTest {
        assertEquals(emptyList<Word>(), dao.allWordsOnce())
        assertNull(dao.firstCreatedAt())
        assertEquals(0, dao.wordCount())
    }

    @Test
    fun allWordsOnceIsOldestFirst() = runTest {
        dao.insertWord(testWord("b", createdAt = 20))
        dao.insertWord(testWord("a", createdAt = 10))

        assertEquals(listOf("a", "b"), dao.allWordsOnce().map { it.text })
        assertEquals(10L, dao.firstCreatedAt())
        assertEquals(2, dao.wordCount())
    }

    @Test
    fun updateContentChangesOnlyContent() = runTest {
        val id = dao.insertWord(
            testWord(
                "plural",
                repetitions = 3, easeFactor = 2.36, intervalDays = 6, dueOn = 40, lapses = 1,
                lastReviewedAt = 99, firstReviewedOn = 30, isNew = false, suspended = true,
                autoRefresh = true, refreshedOn = 8,
            ),
        )
        val before = dao.wordById(id)!!

        dao.updateContent(id, "New definition", "New example", "noun")

        assertEquals(
            before.copy(definition = "New definition", example = "New example", partOfSpeech = "noun"),
            dao.wordById(id),
        )
    }

    @Test
    fun markRefreshedChangesOnlyRefreshedOn() = runTest {
        val id = dao.insertWord(
            testWord("plural", repetitions = 3, dueOn = 40, isNew = false, autoRefresh = true),
        )
        val before = dao.wordById(id)!!

        dao.markRefreshed(id, 55)

        assertEquals(before.copy(refreshedOn = 55), dao.wordById(id))
    }

    @Test
    fun reviewedCountOnCountsDistinctWords() = runTest {
        val a = dao.insertWord(testWord("a"))
        val b = dao.insertWord(testWord("b"))
        dao.insertLog(log(a, 10))
        dao.insertLog(log(a, 10))
        dao.insertLog(log(b, 10))
        dao.insertLog(log(b, 11))

        assertEquals(2, dao.reviewedCountOn(10))
        assertEquals(1, dao.reviewedCountOn(11))
        assertEquals(0, dao.reviewedCountOn(12))
    }

    @Test
    fun recentStudyDaysAreDistinctNewestFirstAndLimited() = runTest {
        val a = dao.insertWord(testWord("a"))
        listOf(5L, 9L, 9L, 7L, 8L).forEach { dao.insertLog(log(a, it)) }

        assertEquals(listOf(9L, 8L, 7L, 5L), dao.recentStudyDays(10))
        assertEquals(listOf(9L, 8L), dao.recentStudyDays(2))
    }

    @Test
    fun deletingAWordDeletesItsLogs() = runTest {
        val a = dao.insertWord(testWord("a"))
        val b = dao.insertWord(testWord("b"))
        dao.insertLog(log(a, 10))
        dao.insertLog(log(b, 10))

        dao.deleteWord(dao.wordById(a)!!)

        assertEquals(1, dao.reviewedCountOn(10))
        assertNotNull(dao.wordById(b))
    }

    @Test
    fun aLogForAMissingWordIsRefused() = runTest {
        assertThrows(SQLiteConstraintException::class.java) {
            kotlinx.coroutines.runBlocking { dao.insertLog(log(wordId = 404, day = 10)) }
        }
    }

    @Test
    fun clearLogsAndClearWordsEmptyTheirTables() = runTest {
        val a = dao.insertWord(testWord("a"))
        dao.insertLog(log(a, 10))

        dao.clearLogs()
        assertEquals(emptyList<Long>(), dao.recentStudyDays(10))
        assertEquals(1, dao.wordCount())

        dao.clearWords()
        assertEquals(0, dao.wordCount())
    }
}
