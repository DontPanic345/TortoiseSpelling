package io.github.dontpanic345.tortoisespelling.integration

import androidx.activity.ComponentActivity
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.AndroidComposeTestRule
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.lifecycle.Lifecycle
import androidx.test.ext.junit.rules.ActivityScenarioRule
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import io.github.dontpanic345.tortoisespelling.TortoiseSpellingNavHost
import io.github.dontpanic345.tortoisespelling.data.TortoiseSpellingDao
import io.github.dontpanic345.tortoisespelling.data.TortoiseSpellingDatabase
import io.github.dontpanic345.tortoisespelling.di.AppContainer
import io.github.dontpanic345.tortoisespelling.domain.Days
import io.github.dontpanic345.tortoisespelling.ui.LocalAppContainer
import io.github.dontpanic345.tortoisespelling.ui.TestTags
import io.github.dontpanic345.tortoisespelling.ui.review.Speaker
import io.github.dontpanic345.tortoisespelling.ui.theme.TortoiseSpellingTheme
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.junit.rules.TestRule
import org.junit.runner.Description
import org.junit.runners.model.Statement

/** Keeps the emulator's text-to-speech engine unbound, so Review looks the same on every image. */
private object NeverReadySpeaker : Speaker {
    override val ready: StateFlow<Boolean> = MutableStateFlow(false)

    override fun speak(text: String) = Unit

    override fun shutdown() = Unit
}

data class LogRow(val correct: Boolean, val typedAnswer: String)

/**
 * The app's real navigation, ViewModels and repository over an in-memory database and a
 * [TestClock]. Seed first, then [launch]: Home loads its state once on creation.
 */
class AppHarness : TestRule {
    val compose: AndroidComposeTestRule<ActivityScenarioRule<ComponentActivity>, ComponentActivity> =
        createAndroidComposeRule<ComponentActivity>()

    val clock = TestClock()

    private val context = ApplicationProvider.getApplicationContext<android.content.Context>()
    private lateinit var database: TortoiseSpellingDatabase

    lateinit var container: AppContainer
        private set

    val dao: TortoiseSpellingDao get() = database.dao()

    /** Every review log row, oldest first; the DAO has no query that returns them all. */
    fun logs(): List<LogRow> = database.openHelper.readableDatabase
        .query("SELECT correct, typedAnswer FROM review_log ORDER BY id")
        .use { c ->
            buildList {
                while (c.moveToNext()) {
                    add(LogRow(correct = c.getInt(0) != 0, typedAnswer = c.getString(1)))
                }
            }
        }

    val today: Long get() = Days.today(clock)

    override fun apply(base: Statement, description: Description): Statement =
        compose.apply(
            object : Statement() {
                override fun evaluate() {
                    context.deleteSharedPreferences(SETTINGS_FILE)
                    database = Room.inMemoryDatabaseBuilder(
                        context,
                        TortoiseSpellingDatabase::class.java,
                    ).build()
                    container = AppContainer(
                        context,
                        clock = clock,
                        fuzz = { today, days -> today + days },
                        openDatabase = { database },
                        settingsFile = SETTINGS_FILE,
                        speakerFactory = { NeverReadySpeaker },
                    )
                    // Otherwise Home raises the notification permission prompt over the test.
                    container.settings.setReminderEnabled(false)
                    try {
                        base.evaluate()
                    } finally {
                        database.close()
                        context.deleteSharedPreferences(SETTINGS_FILE)
                    }
                }
            },
            description,
        )

    fun launch() {
        compose.setContent {
            CompositionLocalProvider(LocalAppContainer provides container) {
                TortoiseSpellingTheme {
                    TortoiseSpellingNavHost(startInReview = false, onReviewLaunchHandled = {})
                }
            }
        }
    }

    /** The user coming back tomorrow: Home's ON_RESUME refresh picks up the new day. */
    fun nextDay() {
        val scenario = compose.activityRule.scenario
        scenario.moveToState(Lifecycle.State.CREATED)
        clock.advanceDays(1)
        scenario.moveToState(Lifecycle.State.RESUMED)
    }

    fun awaitText(text: String, substring: Boolean = false) {
        compose.waitUntil(timeoutMillis = WAIT_MILLIS) {
            compose.onAllNodesWithText(text, substring = substring).fetchSemanticsNodes().isNotEmpty()
        }
    }

    fun click(text: String) {
        awaitText(text)
        compose.onNodeWithText(text).performClick()
    }

    fun spell(answer: String) {
        compose.waitUntil(timeoutMillis = WAIT_MILLIS) {
            compose.onAllNodes(hasTestTag(TestTags.REVIEW_ANSWER)).fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithTag(TestTags.REVIEW_ANSWER).performTextInput(answer)
        compose.onNodeWithTag(TestTags.REVIEW_SUBMIT).performClick()
    }

    /** Waits for Home's big "words to practise" number to read [count]. */
    fun awaitPracticeCount(count: Int) {
        compose.waitUntil(timeoutMillis = WAIT_MILLIS) {
            compose.onAllNodes(hasTestTag(TestTags.HOME_PRACTICE_COUNT) and hasText("$count"))
                .fetchSemanticsNodes().isNotEmpty()
        }
    }

    /** The status badge on the "All words" row for [normalized], e.g. "in 6 days". */
    fun awaitRowStatus(normalized: String, status: String) {
        compose.waitUntil(timeoutMillis = WAIT_MILLIS) {
            compose.onAllNodes(
                hasTestTag(TestTags.wordRowStatus(normalized)) and hasText(status),
                useUnmergedTree = true,
            ).fetchSemanticsNodes().isNotEmpty()
        }
    }

    companion object {
        const val SETTINGS_FILE = "integration-test-settings"
        const val WAIT_MILLIS = 5_000L
    }
}
