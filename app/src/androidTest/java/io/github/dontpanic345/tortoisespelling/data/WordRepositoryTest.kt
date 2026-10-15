package io.github.dontpanic345.tortoisespelling.data

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import io.github.dontpanic345.tortoisespelling.domain.ContentEdit
import io.github.dontpanic345.tortoisespelling.domain.Days
import io.github.dontpanic345.tortoisespelling.domain.DefinitionDraft
import io.github.dontpanic345.tortoisespelling.domain.DeviceClock
import io.github.dontpanic345.tortoisespelling.domain.FormDraft
import io.github.dontpanic345.tortoisespelling.domain.WordContent
import io.github.dontpanic345.tortoisespelling.domain.apply
import io.github.dontpanic345.tortoisespelling.domain.simpleContent
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

        val before = dao.contentById(beta.id)!!.toContent()
        val result = repo.updateWord(beta.copy(text = " Alpha "), before)

        assertTrue(result is UpdateResult.Duplicate)
        assertEquals(beta, dao.wordById(beta.id))
        assertEquals(before, dao.contentById(beta.id)!!.toContent())
    }

    @Test
    fun addWordScrubsAFormsTextOutOfTheDefinition() = runTest {
        val content = WordContent(
            listOf(
                DefinitionDraft(
                    "To practise a skill; practice makes perfect.",
                    forms = listOf(FormDraft("practice"), FormDraft("practise")),
                ),
            ),
        )
        repo.addWord("practice", content)

        val saved = dao.allContentOnce().single().toContent()
        assertEquals("To _____ a skill; _____ makes perfect.", saved.definitions.single().text)
        assertEquals(listOf("practice", "practise"), saved.definitions.single().forms.map { it.text })
    }

    @Test
    fun updateWordRenamingTheWordRenamesTheBaseForm() = runTest {
        repo.addWord("recieve", "To get.", "I recieve mail.", null)
        val word = dao.wordByNormalizedText("recieve")!!
        val content = dao.contentById(word.id)!!.toContent()

        val result = repo.updateWord(word.copy(text = "receive"), content)

        assertEquals(UpdateResult.Updated, result)
        assertEquals("receive", dao.wordById(word.id)!!.text)
        assertEquals("receive", dao.contentById(word.id)!!.toContent().definitions[0].forms[0].text)
    }

    @Test
    fun updateWordKeepsSchedulingAndShownAt() = runTest {
        repo.addWord("rhythm", "A pattern.", "The rhythm held.", null)
        val word = dao.wordByNormalizedText("rhythm")!!
        dao.updateWord(word.copy(repetitions = 4, intervalDays = 15, isNew = false))
        val example = dao.contentById(word.id)!!.sorted().definitions[0].forms[0].examples[0]
        dao.markShown(example.id, 777)

        repo.updateWord(
            dao.wordById(word.id)!!,
            dao.contentById(word.id)!!.toContent().apply(ContentEdit.DefinitionText(0, "A beat.")),
        )

        val saved = dao.wordById(word.id)!!
        assertEquals(4, saved.repetitions)
        assertEquals(15, saved.intervalDays)
        val content = dao.contentById(word.id)!!.toContent()
        assertEquals("A beat.", content.definitions[0].text)
        assertEquals(777L, content.definitions[0].forms[0].examples[0].shownAt)
    }

    @Test
    fun importWordsSkipsBlanksAndKnownWordsAndKeepsLocalProgress() = runTest {
        val existing = testWord(
            "known", repetitions = 4, intervalDays = 15, dueOn = 99, isNew = false,
            lastReviewedAt = 5, firstReviewedOn = 20,
        )
        dao.insertWord(existing)
        val before = dao.wordByNormalizedText("known")!!

        fun incoming(word: Word) = ImportedWord(word, simpleContent(word.text, "A definition.", "noun", "Use it."))
        val summary = repo.importWords(
            listOf(
                incoming(testWord("fresh")),
                incoming(testWord("Known", dueOn = 0, repetitions = 0)),
                incoming(testWord("   ")),
                incoming(testWord("FRESH")),
                incoming(testWord("other")),
            ),
        )

        assertEquals(ImportSummary(added = 2, skipped = 3), summary)
        assertEquals(before, dao.wordByNormalizedText("known"))
        assertEquals(3, dao.wordCount())
        val fresh = dao.contentById(dao.wordByNormalizedText("fresh")!!.id)!!.toContent()
        assertEquals(simpleContent("fresh", "A definition.", "noun", "Use it."), fresh)
    }

    @Test
    fun recordReviewWithAStaleSnapshotKeepsALaterWrite() = runTest {
        repo.addWord("rhythm", "A definition.", "An example.", null)
        val stale = dao.wordByNormalizedText("rhythm")!!

        repo.setSuspended(dao.wordById(stale.id)!!, true)
        repo.recordReview(stale, correctFirstTry = true, typedAnswer = "rhythm")

        val saved = dao.wordById(stale.id)!!
        assertEquals(true, saved.suspended)
        assertEquals(1, saved.repetitions)
        assertEquals(false, saved.isNew)
        assertEquals(Days.today(DeviceClock), saved.firstReviewedOn)
        assertNotNull(saved.lastReviewedAt)
        assertEquals(1, dao.reviewedCountOn(Days.today(DeviceClock)))
    }

    @Test
    fun exportAllCarriesTheTreeOldestFirst() = runTest {
        repo.addWord("beta", "Second.", "A beta.", null)
        dao.updateWord(dao.wordByNormalizedText("beta")!!.copy(createdAt = 20))
        repo.addWord("alpha", "First.", "An alpha.", "noun")
        dao.updateWord(dao.wordByNormalizedText("alpha")!!.copy(createdAt = 10))

        val exported = repo.exportAll()

        assertEquals(listOf("alpha", "beta"), exported.map { it.word.text })
        assertEquals("First.", exported[0].toContent().definitions[0].text)
    }
}
