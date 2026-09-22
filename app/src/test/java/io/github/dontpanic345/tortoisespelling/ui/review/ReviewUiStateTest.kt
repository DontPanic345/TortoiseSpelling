package io.github.dontpanic345.tortoisespelling.ui.review

import io.github.dontpanic345.tortoisespelling.data.Word
import io.github.dontpanic345.tortoisespelling.domain.spellingDiff
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ReviewUiStateTest {

    private fun word(text: String) =
        Word(text = text, normalizedText = text, definition = "", example = "", dueOn = 0)

    private fun state(index: Int, phase: ReviewPhase) = ReviewUiState(
        loading = false,
        queue = listOf(word("one"), word("two")),
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
            retypeMissed = false,
        )
        assertFalse(state(index = 1, phase = corrective).ending)
    }
}
