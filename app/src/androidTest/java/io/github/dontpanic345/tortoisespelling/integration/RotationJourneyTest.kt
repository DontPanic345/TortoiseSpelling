package io.github.dontpanic345.tortoisespelling.integration

import io.github.dontpanic345.tortoisespelling.domain.DefinitionDraft
import io.github.dontpanic345.tortoisespelling.domain.ExampleDraft
import io.github.dontpanic345.tortoisespelling.domain.FormDraft
import io.github.dontpanic345.tortoisespelling.domain.WordContent
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.performClick
import kotlinx.coroutines.runBlocking
import org.junit.Rule
import org.junit.Test

class RotationJourneyTest {
    @get:Rule
    val app = AppHarness()

    private fun add(text: String, vararg forms: FormDraft) = runBlocking {
        app.container.repository.addWord(
            text,
            WordContent(listOf(DefinitionDraft(text = "A definition.", forms = forms.toList()))),
        )
    }

    @Test
    fun aWordsSentencesTakeTurns() {
        val weekAgo = app.clock.millis() - 7 * 24 * 60 * 60 * 1000L
        add(
            "necessary",
            FormDraft(
                text = "necessary",
                examples = listOf(
                    ExampleDraft("It is necessary to rest.", shownAt = weekAgo),
                    ExampleDraft("Water is necessary for life."),
                ),
            ),
        )
        app.launch()

        app.awaitPracticeCount(1)
        app.click("Start")
        app.awaitText("Water is _____ for life.")
        app.spell("necessary")
        app.awaitText("All done — see you tomorrow")
        app.click("Done")

        app.nextDay()
        app.awaitPracticeCount(1)
        app.click("Start")
        app.awaitText("It is _____ to rest.")
    }

    @Test
    fun theFormInTheSentenceIsTheAnswer() {
        add(
            "run",
            FormDraft(text = "run"),
            FormDraft(text = "ran", label = "past tense", examples = listOf(ExampleDraft("He ran the whole way home."))),
        )
        app.launch()

        app.awaitPracticeCount(1)
        app.click("Start")
        app.awaitText("past tense", substring = true)
        app.awaitText("He _____ the whole way home.")
        app.spell("run")
        app.awaitText("Not quite")
        app.compose.onNodeWithContentDescription("End session").performClick()

        app.nextDay()
        app.awaitPracticeCount(1)
        app.click("Start")
        app.spell("ran")
        app.awaitText("Next review: tomorrow")
        app.click("Done")
    }
}
