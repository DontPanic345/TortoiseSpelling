package io.github.dontpanic345.tortoisespelling.component

import androidx.compose.material3.SnackbarHostState
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsOff
import androidx.compose.ui.test.assertIsOn
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.assertCountEquals
import io.github.dontpanic345.tortoisespelling.data.Settings
import io.github.dontpanic345.tortoisespelling.ui.TestTags
import io.github.dontpanic345.tortoisespelling.ui.settings.SettingsContent
import io.github.dontpanic345.tortoisespelling.ui.settings.SettingsUiState
import io.github.dontpanic345.tortoisespelling.ui.theme.TortoiseSpellingTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class SettingsContentTest {
    @get:Rule
    val compose = createComposeRule()

    private val calls = mutableListOf<String>()

    private fun show(
        state: SettingsUiState = Fixtures.settings(),
        remindersOn: Boolean = state.settings.reminderEnabled,
    ) {
        compose.setContent {
            TortoiseSpellingTheme(darkTheme = false) {
                SettingsContent(
                    state = state,
                    remindersOn = remindersOn,
                    snackbarHost = SnackbarHostState(),
                    onBack = { calls += "back" },
                    onReminderToggle = { calls += "reminder:$it" },
                    onPickTime = { h, m -> calls += "time:$h:$m" },
                    onSendTest = { calls += "test" },
                    onNewWordsPerDayChange = { calls += "words:$it" },
                    onExport = { calls += "export" },
                    onImport = { calls += "import" },
                    onCloudBackupChange = { calls += "cloud:$it" },
                )
            }
        }
    }

    @Test
    fun sectionsAppearInOrderWithNoKeySection() {
        show()
        // A vertical scroll lays out every child, so offscreen titles still have positions.
        val ys = listOf("Daily reminder", "Practice", "Backup", "About").map {
            compose.onNodeWithText(it).fetchSemanticsNode().positionInRoot.y
        }
        assertEquals(ys.sorted(), ys)
        listOf("API key", "Anthropic", "Test key").forEach {
            compose.onAllNodes(hasText(it, substring = true, ignoreCase = true)).assertCountEquals(0)
        }
    }

    @Test
    fun reminderSwitchReflectsAndFlips() {
        show(Fixtures.settings(reminderEnabled = true))
        compose.onNodeWithTag(TestTags.SETTINGS_REMINDER_SWITCH).assertIsOn().performClick()
        assertEquals(listOf("reminder:false"), calls)
    }

    @Test
    fun reminderOffDisablesTimeButton() {
        show(Fixtures.settings(reminderEnabled = false))
        compose.onNodeWithTag(TestTags.SETTINGS_REMINDER_SWITCH).assertIsOff().performClick()
        compose.onNodeWithTag(TestTags.SETTINGS_REMINDER_TIME_BUTTON).assertIsNotEnabled()
        assertEquals(listOf("reminder:true"), calls)
    }

    @Test
    fun reminderOnEnablesTimeButton() {
        show()
        compose.onNodeWithTag(TestTags.SETTINGS_REMINDER_TIME_BUTTON).assertIsEnabled()
    }

    @Test
    fun stepperCallsWithPlusAndMinusOne() {
        show()
        compose.onNodeWithTag(TestTags.SETTINGS_NEW_WORDS_INCREASE).performScrollTo().performClick()
        compose.onNodeWithTag(TestTags.SETTINGS_NEW_WORDS_DECREASE).performScrollTo().performClick()
        assertEquals(listOf("words:11", "words:9"), calls)
    }

    @Test
    fun stepperDisablesAtTheBounds() {
        show(SettingsUiState(settings = Settings(newWordsPerDay = 100)))
        compose.onNodeWithTag(TestTags.SETTINGS_NEW_WORDS_INCREASE).performScrollTo().assertIsNotEnabled()
        compose.onNodeWithTag(TestTags.SETTINGS_NEW_WORDS_DECREASE).assertIsEnabled()
    }

    @Test
    fun stepperDisablesAtOne() {
        show(SettingsUiState(settings = Settings(newWordsPerDay = 1)))
        compose.onNodeWithTag(TestTags.SETTINGS_NEW_WORDS_DECREASE).performScrollTo().assertIsNotEnabled()
        compose.onNodeWithTag(TestTags.SETTINGS_NEW_WORDS_INCREASE).assertIsEnabled()
    }

    @Test
    fun exportAndImportCallBack() {
        show()
        compose.onNodeWithText("Export").performScrollTo().performClick()
        compose.onNodeWithText("Import").performScrollTo().performClick()
        assertEquals(listOf("export", "import"), calls)
    }

    @Test
    fun exportAndImportAreDisabledWhileBusy() {
        show(Fixtures.settings(busy = true))
        compose.onNodeWithText("Export").performScrollTo().assertIsNotEnabled()
        compose.onNodeWithText("Import").performScrollTo().assertIsNotEnabled()
    }

    @Test
    fun cloudBackupSwitchCalls() {
        show()
        compose.onNodeWithTag(TestTags.SETTINGS_CLOUD_BACKUP_SWITCH).performScrollTo().assertIsOff().performClick()
        assertEquals(listOf("cloud:true"), calls)
    }
}
