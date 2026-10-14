package io.github.dontpanic345.tortoisespelling.component

import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import io.github.dontpanic345.tortoisespelling.data.testCard
import io.github.dontpanic345.tortoisespelling.domain.spellingDiff
import io.github.dontpanic345.tortoisespelling.ui.TestTags
import io.github.dontpanic345.tortoisespelling.ui.review.ReviewContent
import io.github.dontpanic345.tortoisespelling.ui.review.ReviewPhase
import io.github.dontpanic345.tortoisespelling.ui.review.ReviewUiState
import io.github.dontpanic345.tortoisespelling.ui.theme.TortoiseSpellingTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class ReviewContentTest {
    @get:Rule
    val compose = createComposeRule()

    private val queue = listOf(
        testCard("rhythm", definition = "A strong, regular pattern of sound.", example = "The rhythm of the drums was steady."),
        testCard("necessary", definition = "Required to be done.", example = "It is necessary to rest."),
    )

    private val inputs = mutableListOf<String>()
    private var submits = 0
    private var shownAnswers = 0
    private var quits = 0

    private fun show(state: ReviewUiState) {
        compose.setContent {
            TortoiseSpellingTheme(darkTheme = false) {
                ReviewContent(
                    state = state,
                    onInputChange = { inputs += it },
                    onSubmit = { submits++ },
                    onShowAnswer = { shownAnswers++ },
                    onQuit = { quits++ },
                )
            }
        }
    }

    private fun state(
        phase: ReviewPhase = ReviewPhase.Prompting,
        input: String = "",
        index: Int = 0,
        practiceMode: Boolean = false,
    ) = ReviewUiState(
        loading = false,
        queue = queue,
        index = index,
        input = input,
        phase = phase,
        practiceMode = practiceMode,
    )

    private fun missed(revealed: Boolean, retypeMissed: Boolean = false) = ReviewPhase.Corrective(
        attempt = "rythm",
        diff = spellingDiff("rhythm", "rythm"),
        revealed = revealed,
        retypeMissed = retypeMissed,
    )

    @Test
    fun promptingShowsTheDefinitionAndABlankedExample() {
        show(state())
        compose.onNodeWithText("1 / 2").assertExists()
        compose.onNodeWithText("A strong, regular pattern of sound.").assertExists()
        compose.onNodeWithText("The _____ of the drums was steady.").assertExists()
        compose.onNodeWithText("rhythm", substring = true).assertDoesNotExist()
    }

    @Test
    fun checkIsDisabledUntilSomethingIsTyped() {
        show(state())
        compose.onNodeWithTag(TestTags.REVIEW_SUBMIT).assertIsNotEnabled()
    }

    @Test
    fun checkIsEnabledWithInput() {
        show(state(input = "rhy"))
        compose.onNodeWithTag(TestTags.REVIEW_SUBMIT).assertIsEnabled()
    }

    @Test
    fun typingReachesTheCallback() {
        show(state())
        compose.onNodeWithTag(TestTags.REVIEW_ANSWER).performTextInput("r")
        assertEquals(listOf("r"), inputs)
    }

    @Test
    fun checkCallsSubmit() {
        show(state(input = "rhythm"))
        compose.onNodeWithTag(TestTags.REVIEW_SUBMIT).performClick()
        assertEquals(1, submits)
    }

    @Test
    fun missedHidesTheCorrectSpellingAndOffersShowAnswer() {
        show(state(phase = missed(revealed = false), input = ""))
        compose.onNodeWithText("Not quite").assertExists()
        compose.onNodeWithText("You typed").assertExists()
        compose.onNodeWithText("rythm", substring = true).assertExists()
        compose.onNodeWithText("Correct").assertDoesNotExist()
        compose.onNodeWithText("Try again from memory").assertExists()
        compose.onNodeWithText("Show answer").performClick()
        assertEquals(1, shownAnswers)
    }

    @Test
    fun revealedShowsTheCorrectSpellingAndAsksForARetype() {
        show(state(phase = missed(revealed = true), input = "rhythm"))
        compose.onNodeWithText("Correct").assertExists()
        compose.onNodeWithText("Show answer").assertDoesNotExist()
        compose.onNodeWithText("Type the correct spelling").assertExists()
        compose.onNodeWithTag(TestTags.REVIEW_SUBMIT).assertTextEquals("Check retype")
        compose.onNodeWithText("Not yet: type it exactly as shown above.").assertDoesNotExist()
    }

    @Test
    fun aMissedRetypeSaysSo() {
        show(state(phase = missed(revealed = true, retypeMissed = true), input = "rythm"))
        compose.onNodeWithText("Not yet: type it exactly as shown above.").assertExists()
    }

    @Test
    fun correctRevealsTheWordAndTheFullExample() {
        show(state(phase = ReviewPhase.Correct, input = "rhythm"))
        compose.onNodeWithTag(TestTags.REVIEW_CORRECT_WORD).assertTextEquals("rhythm")
        compose.onNodeWithText("The rhythm of the drums was steady.").assertExists()
        compose.onNodeWithTag(TestTags.REVIEW_SUBMIT).assertTextEquals("Continue")
    }

    @Test
    fun theLastCorrectWordHasNoButton() {
        show(state(phase = ReviewPhase.Correct, input = "necessary", index = 1))
        compose.onNodeWithTag(TestTags.REVIEW_CORRECT_WORD).assertExists()
        compose.onNodeWithTag(TestTags.REVIEW_SUBMIT).assertDoesNotExist()
    }

    @Test
    fun practiceModeSaysSo() {
        show(state(practiceMode = true))
        compose.onNodeWithText("Extra practice").assertExists()
        compose.onNodeWithText("1 / 2").assertDoesNotExist()
    }

    @Test
    fun endSessionCallsQuit() {
        show(state())
        compose.onNodeWithContentDescription("End session").performClick()
        assertEquals(1, quits)
    }
}
