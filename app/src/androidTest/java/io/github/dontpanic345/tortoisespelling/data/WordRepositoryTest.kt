package io.github.dontpanic345.tortoisespelling.data

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import io.github.dontpanic345.tortoisespelling.domain.Days
import io.github.dontpanic345.tortoisespelling.domain.DeviceClock
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class WordRepositoryTest {

    private lateinit var db: TortoiseSpellingDatabase
    private lateinit var dao: TortoiseSpellingDao
    private lateinit var repo: WordRepository

    @Before
    fun open() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        db = Room.inMemoryDatabaseBuilder(context, TortoiseSpellingDatabase::class.java).build()
        dao = db.dao()
        repo = WordRepository(dao, SettingsStore(context))
    }

    @After
    fun close() {
        db.close()
    }

    @Test
    fun addWordTrimsAndRejectsADuplicateDifferingInCaseAndSpacing() = runTest {
        val added = repo.addWord("  Necessary ", "Needed.", "It is necessary.", null)
        assertTrue(added is AddResult.Added)
        assertEquals("Necessary", dao.allWordsOnce().single().text)

        val again = repo.addWord("necessary", "Other.", "Other.", null)
        assertTrue(again is AddResult.Duplicate)
        assertEquals(1, dao.wordCount())
    }

    @Test
    fun updateWordRenamingOntoAnExistingWordIsADuplicateAndChangesNothing() = runTest {
        repo.addWord("alpha", "First.", "An alpha.", null)
        repo.addWord("beta", "Second.", "A beta.", null)
        val beta = dao.wordByNormalizedText("beta")!!

        val result = repo.updateWord(beta.copy(text = " Alpha "))

        assertTrue(result is UpdateResult.Duplicate)
        assertEquals(beta, dao.wordById(beta.id))
    }

    @Test
    fun importWordsSkipsBlanksAndKnownWordsAndKeepsLocalProgress() = runTest {
        val existing = testWord(
            "known", repetitions = 4, intervalDays = 15, dueOn = 99, isNew = false,
            lastReviewedAt = 5, firstReviewedOn = 20,
        )
        dao.insertWord(existing)
        val before = dao.wordByNormalizedText("known")!!

        val summary = repo.importWords(
            listOf(
                testWord("fresh"),
                testWord("Known", dueOn = 0, repetitions = 0),
                testWord("   "),
                testWord("FRESH"),
                testWord("other"),
            ),
        )

        assertEquals(ImportSummary(added = 2, skipped = 3), summary)
        assertEquals(before, dao.wordByNormalizedText("known"))
        assertEquals(3, dao.wordCount())
    }

    @Test
    fun recordReviewWithAStaleSnapshotKeepsRefreshedContent() = runTest {
        repo.addWord("rhythm", "Old definition.", "Old example.", null)
        val stale = dao.wordByNormalizedText("rhythm")!!

        repo.refreshContent(stale, "New definition.", "New example.", "noun")
        repo.recordReview(stale, correctFirstTry = true, typedAnswer = "rhythm")

        val saved = dao.wordById(stale.id)!!
        assertEquals("New definition.", saved.definition)
        assertEquals("New example.", saved.example)
        assertEquals("noun", saved.partOfSpeech)
        assertEquals(1, saved.repetitions)
        assertEquals(false, saved.isNew)
        assertEquals(Days.today(DeviceClock), saved.firstReviewedOn)
        assertNotNull(saved.lastReviewedAt)
        assertEquals(1, dao.reviewedCountOn(Days.today(DeviceClock)))
    }
}
