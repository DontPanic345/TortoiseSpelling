package io.github.dontpanic345.tortoisespelling.component

import io.github.dontpanic345.tortoisespelling.data.TodayPlan
import io.github.dontpanic345.tortoisespelling.data.testWord
import io.github.dontpanic345.tortoisespelling.domain.WordFilter
import io.github.dontpanic345.tortoisespelling.domain.spellingDiff
import io.github.dontpanic345.tortoisespelling.ui.home.HomeUiState
import io.github.dontpanic345.tortoisespelling.ui.review.ReviewPhase
import io.github.dontpanic345.tortoisespelling.ui.review.ReviewUiState
import io.github.dontpanic345.tortoisespelling.ui.words.WordListUiState
import io.github.dontpanic345.tortoisespelling.ui.words.WordRow

/** Screen states shared by the component and accessibility tests. */
object Fixtures {
    private val queue = listOf(
        testWord("rhythm", definition = "A strong, regular pattern of sound.", example = "The rhythm of the drums was steady."),
        testWord("necessary", definition = "Required to be done.", example = "It is necessary to rest."),
    )

    fun review(phase: ReviewPhase = ReviewPhase.Prompting, input: String = "") = ReviewUiState(
        loading = false,
        queue = queue,
        index = 0,
        input = input,
        phase = phase,
    )

    fun missed(revealed: Boolean, retypeMissed: Boolean = false) = ReviewPhase.Corrective(
        attempt = "rythm",
        diff = spellingDiff("rhythm", "rythm"),
        revealed = revealed,
        retypeMissed = retypeMissed,
    )

    fun homeNoWords() = HomeUiState(loading = false)

    fun homeWithWords(
        due: Int = 0,
        new: Int = 0,
        reviewedToday: Int = 0,
        streak: Int = 0,
        nextDueDay: Long? = null,
    ) = HomeUiState(
        loading = false,
        plan = TodayPlan(due, new),
        totalWords = 5,
        reviewedToday = reviewedToday,
        streak = streak,
        nextDueDay = nextDueDay,
        today = 100,
        greeting = "Good morning",
        dateLabel = "Monday",
    )

    fun wordListEmpty() = WordListUiState(loading = false)

    fun wordListWithRows(): WordListUiState {
        val words = listOf(
            testWord("rhythm").copy(id = 1),
            testWord("necessary").copy(id = 2),
            testWord("liaison").copy(id = 3),
        )
        val statuses = listOf("new", "due today", "in 4 days")
        return WordListUiState(
            loading = false,
            filterCounts = WordFilter.entries.associateWith { 3 },
            rows = words.zip(statuses) { w, s -> WordRow(w, s) },
            totalCount = 3,
        )
    }
}
