package io.github.dontpanic345.tortoisespelling.integration

import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import io.github.dontpanic345.tortoisespelling.data.AddResult
import io.github.dontpanic345.tortoisespelling.data.Word
import io.github.dontpanic345.tortoisespelling.ui.TestTags
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class EditAfterMissJourneyTest {
    @get:Rule
    val app = AppHarness()

    /** A reviewed word due today, as [LapseJourneyTest] seeds it, with a definition to edit. */
    private fun seedDue(text: String, definition: String): Word = runBlocking {
        val added = app.container.repository.addWord(text, definition, "", null) as AddResult.Added
        val day = app.today
        val word = app.dao.wordById(added.id)!!.copy(
            isNew = false,
            repetitions = 2,
            intervalDays = 6,
            dueOn = day,
            firstReviewedOn = day - 7,
        )
        app.dao.updateWord(word)
        word
    }

    private fun word(): Word = runBlocking { app.dao.allWordsOnce().single() }

    private fun editWord() {
        app.compose.waitUntil(timeoutMillis = AppHarness.WAIT_MILLIS) {
            app.compose.onAllNodes(hasTestTag(TestTags.REVIEW_EDIT)).fetchSemanticsNodes().isNotEmpty()
        }
        app.compose.onNodeWithTag(TestTags.REVIEW_EDIT).performClick()
    }

    /** Waits for the editor to open with the word's [definition] loaded. */
    private fun awaitEditor(definition: String) {
        app.compose.waitUntil(timeoutMillis = AppHarness.WAIT_MILLIS) {
            app.compose.onAllNodes(hasTestTag(TestTags.ADD_WORD_DEFINITION) and hasText(definition))
                .fetchSemanticsNodes().isNotEmpty()
        }
    }

    private fun saveDefinition(definition: String, replacing: String) {
        awaitEditor(replacing)
        app.compose.onNodeWithTag(TestTags.ADD_WORD_DEFINITION).performTextReplacement(definition)
        app.compose.onNodeWithTag(TestTags.ADD_WORD_SAVE).performScrollTo().performClick()
    }

    private fun startReview() {
        app.launch()
        app.click("Start")
        app.awaitText("Required to be done.")
    }

    @Test
    fun aSavedEditUndoesTheMissAndAsksAgain() {
        seedDue("necessary", "Required to be done.")
        startReview()
        app.spell("neccesary")
        editWord()
        saveDefinition("Needed.", replacing = "Required to be done.")

        app.awaitText("Needed.")
        app.awaitText("1 / 1")
        app.spell("necessary")
        app.awaitText("All done", substring = true)

        val word = word()
        assertEquals(3, word.repetitions)
        assertEquals(0, word.lapses)
        assertTrue(word.dueOn > app.today)
        assertEquals(listOf(LogRow(correct = true, typedAnswer = "necessary")), app.logs())
    }

    @Test
    fun backFromTheEditorKeepsTheMiss() {
        seedDue("necessary", "Required to be done.")
        startReview()
        app.spell("neccesary")
        editWord()
        awaitEditor("Required to be done.")
        app.compose.onNodeWithContentDescription("Back").performClick()

        app.awaitText("Not quite")
        assertEquals(1, word().lapses)
        assertEquals(listOf(LogRow(correct = false, typedAnswer = "neccesary")), app.logs())
    }

    @Test
    fun deletingTheWordMovesOnToTheNext() {
        seedDue("necessary", "Required to be done.")
        seedDue("rhythm", "A strong, regular pattern of sound.")
        app.launch()
        app.click("Start")
        app.awaitText("1 / 2")
        // The due words are shuffled, so miss whichever came first.
        val necessaryFirst = app.compose.onAllNodesWithText("Required to be done.")
            .fetchSemanticsNodes().isNotEmpty()
        val nextDefinition = if (necessaryFirst) "A strong, regular pattern of sound." else "Required to be done."
        app.spell("zzz")
        editWord()
        awaitEditor(if (necessaryFirst) "Required to be done." else "A strong, regular pattern of sound.")
        app.compose.onNodeWithContentDescription("Delete word").performClick()

        app.awaitText(nextDefinition)
        app.awaitText("1 / 1")
        assertEquals(1, runBlocking { app.dao.allWordsOnce() }.size)
    }

    @Test
    fun deletingTheOnlyWordFinishesTheSession() {
        seedDue("necessary", "Required to be done.")
        startReview()
        app.spell("neccesary")
        editWord()
        awaitEditor("Required to be done.")
        app.compose.onNodeWithContentDescription("Delete word").performClick()

        app.awaitText("All done", substring = true)
    }

    @Test
    fun endingTheSessionAfterASaveLeavesTheWordUnreviewed() {
        val seeded = seedDue("necessary", "Required to be done.")
        startReview()
        app.spell("neccesary")
        editWord()
        saveDefinition("Needed.", replacing = "Required to be done.")
        app.awaitText("Needed.")
        app.compose.onNodeWithContentDescription("End session").performClick()

        app.awaitPracticeCount(1)
        assertEquals(seeded, word())
        assertEquals(emptyList<LogRow>(), app.logs())
    }

    @Test
    fun aSavedEditInPracticeAsksAgainAndRecordsNothing() {
        seedDue("necessary", "Required to be done.")
        startReview()
        app.spell("necessary")
        app.awaitText("All done", substring = true)
        val before = word()
        val logsBefore = app.logs()

        app.click("Practise a few more anyway")
        app.awaitText("Extra practice")
        app.spell("neccesary")
        editWord()
        saveDefinition("Needed.", replacing = "Required to be done.")

        app.awaitText("Needed.")
        assertEquals(before, word())
        assertEquals(logsBefore, app.logs())
    }
}
