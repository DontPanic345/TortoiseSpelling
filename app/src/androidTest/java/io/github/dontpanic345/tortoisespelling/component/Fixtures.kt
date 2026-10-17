package io.github.dontpanic345.tortoisespelling.component

import io.github.dontpanic345.tortoisespelling.data.Settings
import io.github.dontpanic345.tortoisespelling.data.TodayPlan
import io.github.dontpanic345.tortoisespelling.data.testCard
import io.github.dontpanic345.tortoisespelling.data.testWord
import io.github.dontpanic345.tortoisespelling.domain.ContentEdit
import io.github.dontpanic345.tortoisespelling.domain.PastedLookup
import io.github.dontpanic345.tortoisespelling.domain.WordContent
import io.github.dontpanic345.tortoisespelling.domain.WordFilter
import io.github.dontpanic345.tortoisespelling.domain.apply
import io.github.dontpanic345.tortoisespelling.domain.spellingDiff
import io.github.dontpanic345.tortoisespelling.ui.add.AddWordUiState
import io.github.dontpanic345.tortoisespelling.ui.add.PasteDraft
import io.github.dontpanic345.tortoisespelling.ui.home.HomeUiState
import io.github.dontpanic345.tortoisespelling.ui.review.ReviewPhase
import io.github.dontpanic345.tortoisespelling.ui.settings.SettingsUiState
import io.github.dontpanic345.tortoisespelling.ui.review.ReviewUiState
import io.github.dontpanic345.tortoisespelling.ui.words.WordListUiState
import io.github.dontpanic345.tortoisespelling.ui.words.WordRow

/** Screen states shared by the component and accessibility tests. */
object Fixtures {
    private val queue = listOf(
        testCard("rhythm", definition = "A strong, regular pattern of sound.", example = "The rhythm of the drums was steady."),
        testCard("necessary", definition = "Required to be done.", example = "It is necessary to rest."),
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
            rows = words.zip(statuses) { w, s -> WordRow(w, s, "A definition of ${w.text}.") },
            totalCount = 3,
        )
    }

    fun addNew() = AddWordUiState()

    /** "run" with a "ran" form (past tense) whose example contains it. */
    fun addRun() = AddWordUiState(
        text = "run",
        content = WordContent.blank()
            .apply(ContentEdit.DefinitionText(0, "To move fast on foot."))
            .apply(ContentEdit.PartOfSpeech(0, "verb"))
            .apply(ContentEdit.ExampleText(0, 0, 0, "They run every day."))
            .apply(ContentEdit.AddForm(0))
            .apply(ContentEdit.FormText(0, 1, "ran"))
            .apply(ContentEdit.FormLabel(0, 1, "past tense"))
            .apply(ContentEdit.ExampleText(0, 1, 0, "He ran the whole way home.")),
    )

    fun addRunWithTwoDefinitions() = addRun().let {
        it.copy(
            content = it.content
                .apply(ContentEdit.AddDefinition)
                .apply(ContentEdit.DefinitionText(1, "A stretch of success or a sequence."))
                .apply(ContentEdit.PartOfSpeech(1, "noun")),
        )
    }

    /** The paste dialog open on an answer that failed validation. */
    fun addPasteInvalid() = addNew().copy(
        text = "run",
        paste = PasteDraft(
            text = "Sure! Here you go",
            result = PastedLookup.Invalid("That JSON is broken, so Tortoise Spelling can't read it. A bracket or comma may be missing. Ask the chat to fix it, or copy its whole answer again."),
        ),
    )

    /** The paste dialog open on a valid answer for [answer], typed as [typed]. */
    fun addPasteValid(typed: String = "run", answer: String = "run"): AddWordUiState {
        val content = addRun().content
        return addNew().copy(
            text = typed,
            paste = PasteDraft(
                text = "{\"word\": \"$answer\"}",
                result = PastedLookup.Valid(answer, content, renames = !typed.equals(answer, ignoreCase = true)),
            ),
        )
    }

    fun addRunWithExampleMissingTheForm() = addRun().let {
        it.copy(content = it.content.apply(ContentEdit.ExampleText(0, 1, 0, "He sprinted the whole way home.")))
    }

    fun settings(reminderEnabled: Boolean = true, busy: Boolean = false) = SettingsUiState(
        settings = Settings(reminderEnabled = reminderEnabled),
        busy = busy,
    )
}
