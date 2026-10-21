package io.github.dontpanic345.tortoisespelling.data

import android.database.sqlite.SQLiteConstraintException
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import io.github.dontpanic345.tortoisespelling.domain.DefinitionDraft
import io.github.dontpanic345.tortoisespelling.domain.ExampleDraft
import io.github.dontpanic345.tortoisespelling.domain.FormDraft
import io.github.dontpanic345.tortoisespelling.domain.Reviewed
import io.github.dontpanic345.tortoisespelling.domain.WordContent
import io.github.dontpanic345.tortoisespelling.domain.simpleContent
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
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

    private fun logIds(): List<Long> = db.openHelper.readableDatabase.query("SELECT id FROM review_log").use { c ->
        buildList { while (c.moveToNext()) add(c.getLong(0)) }
    }

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
    fun observeWordsWithContentIsNewestFirstAndEmitsAfterInsertAndContentChange() = runTest {
        dao.insertWordWithContent(testWord("old", createdAt = 1), simpleContent("old", "Aged.", null, ""))
        val newId = dao.insertWordWithContent(testWord("new", createdAt = 2), simpleContent("new", "Recent.", null, ""))
        assertEquals(listOf("new", "old"), dao.observeWordsWithContent().first().map { it.word.text })

        dao.insertWordWithContent(testWord("newest", createdAt = 3), simpleContent("newest", "Latest.", null, ""))
        assertEquals(
            listOf("newest", "new", "old"),
            dao.observeWordsWithContent().first().map { it.word.text },
        )

        val definitions = Channel<List<String>>(Channel.UNLIMITED)
        val collector = launch(Dispatchers.Default) {
            dao.observeWordsWithContent().collect { words ->
                definitions.send(words.single { it.word.id == newId }.definitions.map { it.definition.text })
            }
        }
        withContext(Dispatchers.Default) {
            withTimeout(5_000) {
                assertEquals(listOf("Recent."), definitions.receive())
                dao.updateWordWithContent(
                    dao.wordById(newId)!!,
                    simpleContent("new", "Brand new.", null, ""),
                )
                while (definitions.receive() != listOf("Brand new.")) {
                    // Wait for the content-only change to reach the flow.
                }
            }
        }
        collector.cancel()
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

    private val tree = WordContent(
        listOf(
            DefinitionDraft(
                "To move fast on foot.",
                "verb",
                listOf(
                    FormDraft("run", examples = listOf(ExampleDraft("I run daily."), ExampleDraft("We run on.", shownAt = 7))),
                    FormDraft("ran", label = "past tense", examples = listOf(ExampleDraft("He ran home."))),
                ),
            ),
            DefinitionDraft(
                "An enclosed pen.",
                forms = listOf(FormDraft("run", examples = listOf(ExampleDraft("A chicken run.")))),
            ),
        ),
    )

    @Test
    fun insertWordWithContentStoresTheTreeInOrder() = runTest {
        val id = dao.insertWordWithContent(testWord("run"), tree)

        assertEquals(tree, dao.contentById(id)!!.toContent())
        val stored = dao.contentById(id)!!.sorted()
        assertEquals(listOf(0, 1), stored.definitions.map { it.definition.orderIndex })
        assertEquals(listOf(0, 1), stored.definitions[0].forms.map { it.form.orderIndex })
        assertEquals(listOf(null, "past tense"), stored.definitions[0].forms.map { it.form.label })
        assertEquals(listOf<String?>("verb", null), stored.definitions.map { it.definition.partOfSpeech })
        assertEquals(7L, stored.definitions[0].forms[0].examples[1].shownAt)
    }

    @Test
    fun contentByIdSortsByOrderIndexWhateverTheInsertOrder() = runTest {
        val wordId = dao.insertWord(testWord("run"))
        val second = dao.insertDefinition(Definition(wordId = wordId, text = "Second.", orderIndex = 1))
        val first = dao.insertDefinition(Definition(wordId = wordId, text = "First.", orderIndex = 0))
        val lateForm = dao.insertForm(WordForm(definitionId = first, text = "ran", orderIndex = 1))
        val earlyForm = dao.insertForm(WordForm(definitionId = first, text = "run", orderIndex = 0))
        dao.insertExample(ExampleSentence(wordFormId = earlyForm, text = "B.", orderIndex = 1))
        dao.insertExample(ExampleSentence(wordFormId = earlyForm, text = "A.", orderIndex = 0))
        dao.insertForm(WordForm(definitionId = second, text = "runs", orderIndex = 0))

        val content = dao.contentById(wordId)!!.sorted()

        assertEquals(listOf("First.", "Second."), content.definitions.map { it.definition.text })
        assertEquals(listOf("run", "ran"), content.definitions[0].forms.map { it.form.text })
        assertEquals(listOf("A.", "B."), content.definitions[0].forms[0].examples.map { it.text })
        assertEquals(lateForm, content.definitions[0].forms[1].form.id)
    }

    @Test
    fun updateWordWithContentReplacesTheTreeAndLeavesSchedulingAndLogsAlone() = runTest {
        val id = dao.insertWordWithContent(
            testWord(
                "plural",
                repetitions = 3, easeFactor = 2.36, intervalDays = 6, dueOn = 40, lapses = 1,
                lastReviewedAt = 99, firstReviewedOn = 30, isNew = false, suspended = true,
            ),
            simpleContent("plural", "Old.", "noun", "An old plural."),
        )
        dao.insertLog(log(id, 30))
        val before = dao.wordById(id)!!

        dao.updateWordWithContent(before, simpleContent("plural", "New.", null, "A new plural."))

        assertEquals(before, dao.wordById(id))
        assertEquals(1, dao.reviewedCountOn(30))
        assertEquals(
            simpleContent("plural", "New.", null, "A new plural."),
            dao.contentById(id)!!.toContent(),
        )
        assertEquals(1, db.query("SELECT COUNT(*) FROM definitions", null).use { it.moveToFirst(); it.getInt(0) })
    }

    @Test
    fun deletingAWordCascadesThroughAllThreeContentTables() = runTest {
        val kept = dao.insertWordWithContent(testWord("kept"), tree)
        val gone = dao.insertWordWithContent(testWord("gone"), tree)

        dao.deleteWord(dao.wordById(gone)!!)

        for ((table, perWord) in listOf("definitions" to 2, "word_forms" to 3, "example_sentences" to 4)) {
            db.query("SELECT COUNT(*) FROM $table", null).use {
                it.moveToFirst()
                assertEquals(table, perWord, it.getInt(0))
            }
        }
        assertNotNull(dao.contentById(kept))
        assertNull(dao.contentById(gone))
    }

    @Test
    fun markShownChangesOnlyItsRow() = runTest {
        val id = dao.insertWordWithContent(testWord("run"), tree)
        val before = dao.contentById(id)!!.sorted().definitions.flatMap { d -> d.forms.flatMap { it.examples } }

        dao.markShown(before[0].id, 12_345)

        val after = dao.contentById(id)!!.sorted().definitions.flatMap { d -> d.forms.flatMap { it.examples } }
        assertEquals(before.drop(1), after.drop(1))
        assertEquals(before[0].copy(shownAt = 12_345), after[0])
    }

    @Test
    fun contentForReturnsEveryWordEvenPastTheVariableLimit() = runTest {
        val ids = (1..1_200).map { dao.insertWord(testWord("word$it")) }

        val found = dao.contentFor(ids)

        assertEquals(1_200, found.size)
        assertEquals(ids.toSet(), found.map { it.word.id }.toSet())
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
    fun recordReviewRollsBackTheWordWhenTheLogIsRefused() = runTest {
        val id = dao.insertWord(testWord("rhythm"))
        val before = dao.wordById(id)!!

        assertThrows(SQLiteConstraintException::class.java) {
            kotlinx.coroutines.runBlocking {
                dao.recordReview(id) { Reviewed(it.copy(repetitions = 7), log(wordId = 404, day = 10)) }
            }
        }

        assertEquals(before, dao.wordById(id))
    }

    @Test
    fun recordReviewReturnsTheLogRowAndTheWordAsItWas() = runTest {
        val id = dao.insertWord(testWord("rhythm"))
        val before = dao.wordById(id)!!

        val undo = dao.recordReview(id) { Reviewed(it.copy(repetitions = 7), log(id, day = 10)) }!!

        assertEquals(id, undo.wordId)
        assertEquals(before, undo.before)
        assertEquals(listOf(undo.logId), logIds())
    }

    @Test
    fun recordReviewForAMissingWordReturnsNull() = runTest {
        assertNull(dao.recordReview(404) { Reviewed(it, log(404, day = 10)) })
        assertEquals(emptyList<Long>(), logIds())
    }

    @Test
    fun undoReviewForAMissingWordReturnsFalse() = runTest {
        assertEquals(false, dao.undoReview(ReviewUndo(wordId = 404, logId = 1, before = testWord("gone"))))
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
