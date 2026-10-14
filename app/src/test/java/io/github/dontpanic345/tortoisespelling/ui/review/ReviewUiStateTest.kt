package io.github.dontpanic345.tortoisespelling.ui.review

import io.github.dontpanic345.tortoisespelling.data.ExampleSentence
import io.github.dontpanic345.tortoisespelling.data.Word
import io.github.dontpanic345.tortoisespelling.domain.ReviewCard
import io.github.dontpanic345.tortoisespelling.domain.spellingDiff
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ReviewUiStateTest {

    private fun card(form: String, example: String? = null) = ReviewCard(
        word = Word(text = form, normalizedText = form, dueOn = 0),
        definition = "",
        partOfSpeech = null,
        form = form,
        label = null,
        example = example?.let { ExampleSentence(wordFormId = 1, text = it, orderIndex = 0) },
    )

    private fun state(index: Int, phase: ReviewPhase) = ReviewUiState(
        loading = false,
        queue = listOf(card("one"), card("two")),
        index = index,
        phase = phase,
    )

    @Test
    fun `the last word answered correctly is the end of the session`() {
        assertTrue(state(index = 1, phase = ReviewPhase.Correct).ending)
    }

    @Test
    fun `an earlier word answered correctly still has a word to come`() {
        assertFalse(state(index = 0, phase = ReviewPhase.Correct).ending)
    }

    @Test
    fun `the last word is not ending while it is still being typed`() {
        assertFalse(state(index = 1, phase = ReviewPhase.Prompting).ending)
    }

    @Test
    fun `a missed last word is not ending until the retype is accepted`() {
        val corrective = ReviewPhase.Corrective(
            attempt = "tow",
            diff = spellingDiff("two", "tow"),
            revealed = true,
            retypeMissed = false,
        )
        assertFalse(state(index = 1, phase = corrective).ending)
    }

    @Test
    fun `the example is blanked at the asked form`() {
        val state = ReviewUiState(
            loading = false,
            queue = listOf(card("ran", example = "He ran the whole way home.")),
        )
        assertEquals("He _____ the whole way home.", state.blankedExample?.text)
    }

    @Test
    fun `a card without an example has nothing to blank`() {
        assertNull(ReviewUiState(loading = false, queue = listOf(card("ran"))).blankedExample)
    }
}
