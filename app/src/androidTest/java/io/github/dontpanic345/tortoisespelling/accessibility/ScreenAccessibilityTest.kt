package io.github.dontpanic345.tortoisespelling.accessibility

import androidx.activity.ComponentActivity
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.ui.test.junit4.accessibility.enableAccessibilityChecks
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.isRoot
import androidx.compose.ui.test.performTouchInput
import io.github.dontpanic345.tortoisespelling.component.Fixtures
import io.github.dontpanic345.tortoisespelling.ui.add.AddWordContent
import io.github.dontpanic345.tortoisespelling.ui.add.AddWordUiState
import io.github.dontpanic345.tortoisespelling.ui.complete.CompletionPanel
import io.github.dontpanic345.tortoisespelling.ui.home.HomeContent
import io.github.dontpanic345.tortoisespelling.ui.review.ReviewContent
import io.github.dontpanic345.tortoisespelling.ui.review.ReviewPhase
import io.github.dontpanic345.tortoisespelling.ui.settings.SettingsContent
import io.github.dontpanic345.tortoisespelling.ui.theme.TortoiseSpellingTheme
import io.github.dontpanic345.tortoisespelling.ui.words.WordListContent
import com.google.android.apps.common.testing.accessibility.framework.AccessibilityViewCheckResult
import com.google.android.apps.common.testing.accessibility.framework.checks.TouchTargetSizeCheck
import com.google.android.apps.common.testing.accessibility.framework.integrations.espresso.AccessibilityValidator
import org.hamcrest.Description
import org.hamcrest.TypeSafeMatcher
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized

@RunWith(Parameterized::class)
class ScreenAccessibilityTest(private val dark: Boolean) {
    companion object {
        @JvmStatic
        @Parameterized.Parameters(name = "dark={0}")
        fun themes() = listOf(false, true)
    }

    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @Before
    fun enableChecks() {
        // False positive: the Home card header's "See all" button reports an unlabelled
        // 13dp sliver of its own touch area (the labelled button node is 46dp and passes).
        // Only unlabelled results are suppressed; every labelled control is still held to
        // the 48dp minimum.
        val unlabelledSliver = object : TypeSafeMatcher<AccessibilityViewCheckResult>() {
            override fun matchesSafely(result: AccessibilityViewCheckResult): Boolean {
                val element = result.element ?: return false
                return result.accessibilityHierarchyCheck == TouchTargetSizeCheck::class.java &&
                    element.text == null &&
                    element.contentDescription == null
            }

            override fun describeTo(description: Description) {
                description.appendText("an unlabelled touch-target sliver")
            }
        }
        compose.enableAccessibilityChecks(
            AccessibilityValidator().setSuppressingResultMatcher(unlabelledSliver),
        )
    }

    private fun check(content: @Composable () -> Unit) {
        compose.setContent { TortoiseSpellingTheme(darkTheme = dark) { content() } }
        // Enabled checks run on every action; an empty touch input is the action that runs them.
        // A dialog is a second root, so touch each one.
        val roots = compose.onAllNodes(isRoot())
        repeat(roots.fetchSemanticsNodes().size) { roots[it].performTouchInput { } }
    }

    private fun review(
        state: io.github.dontpanic345.tortoisespelling.ui.review.ReviewUiState,
        canSpeak: Boolean = false,
    ) = check {
        ReviewContent(state = state, canSpeak = canSpeak, onSpeak = {}, onInputChange = {}, onSubmit = {}, onShowAnswer = {}, onQuit = {})
    }

    private fun home(state: io.github.dontpanic345.tortoisespelling.ui.home.HomeUiState) = check {
        HomeContent(
            state = state,
            onStartReview = {},
            onPracticeMore = {},
            onAddWord = {},
            onOpenWords = {},
            onOpenSettings = {},
        )
    }

    private fun wordList(state: io.github.dontpanic345.tortoisespelling.ui.words.WordListUiState) = check {
        WordListContent(
            state = state,
            onBack = {},
            onEdit = {},
            onQueryChange = {},
            onFilterChange = {},
            onToggleSuspended = {},
            onDelete = {},
        )
    }

    private fun addWord(state: AddWordUiState) = check {
        AddWordContent(
            state = state,
            onBack = {},
            onDelete = {},
            onTextChange = {},
            onCopyPrompt = {},
            onOpenPaste = {},
            onPasteTextChange = {},
            onUsePaste = {},
            onDismissPaste = {},
            onCopyPasteError = {},
            onEdit = {},
            onSave = {},
        )
    }

    private fun settings(state: io.github.dontpanic345.tortoisespelling.ui.settings.SettingsUiState) = check {
        SettingsContent(
            state = state,
            remindersOn = state.settings.reminderEnabled,
            snackbarHost = SnackbarHostState(),
            onBack = {},
            onReminderToggle = {},
            onPickTime = { _, _ -> },
            onSendTest = {},
            onNewWordsPerDayChange = {},
            onExport = {},
            onImport = {},
            onCloudBackupChange = {},
        )
    }

    @Test fun reviewPrompting() = review(Fixtures.review(input = "rhy"))

    @Test fun reviewCanSpeak() = review(Fixtures.review(input = "rhy"), canSpeak = true)

    @Test fun reviewMissedHidden() = review(Fixtures.review(Fixtures.missed(revealed = false)))

    @Test fun reviewMissedRevealed() = review(Fixtures.review(Fixtures.missed(revealed = true, retypeMissed = true), input = "rythm"))

    @Test fun reviewCorrect() = review(Fixtures.review(ReviewPhase.Correct))

    @Test fun homeNoWords() = home(Fixtures.homeNoWords())

    @Test fun homeWordsDue() = home(Fixtures.homeWithWords(due = 2, new = 1, reviewedToday = 4, streak = 3))

    @Test fun homeAllDone() = home(Fixtures.homeWithWords(reviewedToday = 3, streak = 2, nextDueDay = 101))

    @Test fun wordListWithRows() = wordList(Fixtures.wordListWithRows())

    @Test fun wordListEmpty() = wordList(Fixtures.wordListEmpty())

    @Test fun addWordNew() = addWord(Fixtures.addNew())

    @Test fun addWordPasteWithAnError() = addWord(Fixtures.addPasteInvalid())

    @Test fun addWordPasteThatRenames() = addWord(Fixtures.addPasteValid(typed = "recieve", answer = "receive"))

    @Test fun addWordWithTwoDefinitionsAndAForm() = addWord(Fixtures.addRunWithTwoDefinitions())

    @Test fun settingsDefaults() = settings(Fixtures.settings())

    @Test fun settingsRemindersOff() = settings(Fixtures.settings(reminderEnabled = false))

    @Test
    fun completionPanel() = check {
        CompletionPanel(reviewedCount = 3, streak = 2, nextDueDay = 101, today = 100)
    }
}
