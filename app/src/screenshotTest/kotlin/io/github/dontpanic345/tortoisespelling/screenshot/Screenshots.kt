package io.github.dontpanic345.tortoisespelling.screenshot

import android.content.res.Configuration.UI_MODE_NIGHT_YES
import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import com.android.tools.screenshot.PreviewTest
import io.github.dontpanic345.tortoisespelling.data.ExampleSentence
import io.github.dontpanic345.tortoisespelling.data.TodayPlan
import io.github.dontpanic345.tortoisespelling.data.Word
import io.github.dontpanic345.tortoisespelling.domain.ReviewCard
import io.github.dontpanic345.tortoisespelling.domain.WordFilter
import io.github.dontpanic345.tortoisespelling.domain.spellingDiff
import io.github.dontpanic345.tortoisespelling.ui.complete.CompletionPanel
import io.github.dontpanic345.tortoisespelling.ui.home.HomeContent
import io.github.dontpanic345.tortoisespelling.ui.home.HomeUiState
import io.github.dontpanic345.tortoisespelling.ui.review.ReviewContent
import io.github.dontpanic345.tortoisespelling.ui.review.ReviewPhase
import io.github.dontpanic345.tortoisespelling.ui.review.ReviewUiState
import io.github.dontpanic345.tortoisespelling.ui.theme.TortoiseSpellingTheme
import io.github.dontpanic345.tortoisespelling.ui.words.WordListContent
import io.github.dontpanic345.tortoisespelling.ui.words.WordListUiState
import io.github.dontpanic345.tortoisespelling.ui.words.WordRow

private fun word(text: String, id: Long = 0) = Word(
    id = id,
    text = text,
    normalizedText = text.lowercase(),
    createdAt = 0,
    dueOn = 100,
)

private fun card(
    text: String,
    definition: String,
    example: String,
    form: String = text,
    label: String? = null,
    partOfSpeech: String? = null,
) = ReviewCard(
    word = word(text),
    definition = definition,
    partOfSpeech = partOfSpeech,
    form = form,
    label = label,
    example = ExampleSentence(wordFormId = 0, text = example, orderIndex = 0),
)

private val queue = listOf(
    card("rhythm", "A strong, regular pattern of sound.", "The rhythm of the drums was steady."),
    card("necessary", "Required to be done.", "It is necessary to rest."),
)

private fun review(phase: ReviewPhase = ReviewPhase.Prompting, input: String = "") =
    ReviewUiState(loading = false, queue = queue, index = 0, input = input, phase = phase)

private fun missed(revealed: Boolean, retypeMissed: Boolean = false) = ReviewPhase.Corrective(
    attempt = "rythm",
    diff = spellingDiff("rhythm", "rythm"),
    revealed = revealed,
    retypeMissed = retypeMissed,
)

private fun home(
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

private fun wordListWithRows(): WordListUiState {
    val words = listOf(
        word("rhythm", 1) to "A strong, regular pattern of sound.",
        word("necessary", 2) to "Required to be done.",
        word("liaison", 3) to "A close connection.",
    )
    val statuses = listOf("new", "due today", "in 4 days")
    return WordListUiState(
        loading = false,
        filterCounts = WordFilter.entries.associateWith { 3 },
        rows = words.zip(statuses) { (w, definition), s -> WordRow(w, s, definition) },
        totalCount = 3,
    )
}

@Composable
private fun Themed(dark: Boolean, content: @Composable () -> Unit) =
    TortoiseSpellingTheme(darkTheme = dark) { content() }

@Composable
private fun ReviewShot(dark: Boolean, state: ReviewUiState) = Themed(dark) {
    ReviewContent(state = state, onInputChange = {}, onSubmit = {}, onShowAnswer = {}, onQuit = {})
}

@Composable
private fun HomeShot(dark: Boolean, state: HomeUiState) = Themed(dark) {
    HomeContent(
        state = state,
        onStartReview = {},
        onPracticeMore = {},
        onAddWord = {},
        onOpenWords = {},
        onOpenSettings = {},
    )
}

@Composable
private fun WordListShot(dark: Boolean, state: WordListUiState) = Themed(dark) {
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

@PreviewTest
@Preview(showBackground = true)
@Composable
fun ReviewPromptingLight() = ReviewShot(dark = false, state = review(input = "rhy"))

@PreviewTest
@Preview(showBackground = true, uiMode = UI_MODE_NIGHT_YES)
@Composable
fun ReviewPromptingDark() = ReviewShot(dark = true, state = review(input = "rhy"))

@PreviewTest
@Preview(showBackground = true)
@Composable
fun ReviewMissedHiddenLight() = ReviewShot(dark = false, state = review(missed(revealed = false)))

@PreviewTest
@Preview(showBackground = true, uiMode = UI_MODE_NIGHT_YES)
@Composable
fun ReviewMissedHiddenDark() = ReviewShot(dark = true, state = review(missed(revealed = false)))

@PreviewTest
@Preview(showBackground = true)
@Composable
fun ReviewMissedRevealedLight() = ReviewShot(dark = false, state = review(missed(revealed = true, retypeMissed = true), input = "rythm"))

@PreviewTest
@Preview(showBackground = true, uiMode = UI_MODE_NIGHT_YES)
@Composable
fun ReviewMissedRevealedDark() = ReviewShot(dark = true, state = review(missed(revealed = true, retypeMissed = true), input = "rythm"))

@PreviewTest
@Preview(showBackground = true)
@Composable
fun ReviewCorrectLight() = ReviewShot(dark = false, state = review(ReviewPhase.Correct))

@PreviewTest
@Preview(showBackground = true, uiMode = UI_MODE_NIGHT_YES)
@Composable
fun ReviewCorrectDark() = ReviewShot(dark = true, state = review(ReviewPhase.Correct))

private val labelled = ReviewUiState(
    loading = false,
    queue = listOf(card("run", "To move fast on foot.", "He ran the whole way home.", form = "ran", label = "past tense", partOfSpeech = "verb")),
)

@PreviewTest
@Preview(showBackground = true)
@Composable
fun ReviewFormLabelLight() = ReviewShot(dark = false, state = labelled)

@PreviewTest
@Preview(showBackground = true, uiMode = UI_MODE_NIGHT_YES)
@Composable
fun ReviewFormLabelDark() = ReviewShot(dark = true, state = labelled)

@PreviewTest
@Preview(showBackground = true)
@Composable
fun HomeNoWordsLight() = HomeShot(dark = false, state = HomeUiState(loading = false))

@PreviewTest
@Preview(showBackground = true, uiMode = UI_MODE_NIGHT_YES)
@Composable
fun HomeNoWordsDark() = HomeShot(dark = true, state = HomeUiState(loading = false))

@PreviewTest
@Preview(showBackground = true)
@Composable
fun HomeWordsDueLight() = HomeShot(dark = false, state = home(due = 2, new = 1, reviewedToday = 4, streak = 3))

@PreviewTest
@Preview(showBackground = true, uiMode = UI_MODE_NIGHT_YES)
@Composable
fun HomeWordsDueDark() = HomeShot(dark = true, state = home(due = 2, new = 1, reviewedToday = 4, streak = 3))

@PreviewTest
@Preview(showBackground = true)
@Composable
fun HomeAllDoneLight() = HomeShot(dark = false, state = home(reviewedToday = 3, streak = 2, nextDueDay = 101))

@PreviewTest
@Preview(showBackground = true, uiMode = UI_MODE_NIGHT_YES)
@Composable
fun HomeAllDoneDark() = HomeShot(dark = true, state = home(reviewedToday = 3, streak = 2, nextDueDay = 101))

@PreviewTest
@Preview(showBackground = true)
@Composable
fun WordListWithRowsLight() = WordListShot(dark = false, state = wordListWithRows())

@PreviewTest
@Preview(showBackground = true, uiMode = UI_MODE_NIGHT_YES)
@Composable
fun WordListWithRowsDark() = WordListShot(dark = true, state = wordListWithRows())

@PreviewTest
@Preview(showBackground = true)
@Composable
fun WordListEmptyLight() = WordListShot(dark = false, state = WordListUiState(loading = false))

@PreviewTest
@Preview(showBackground = true, uiMode = UI_MODE_NIGHT_YES)
@Composable
fun WordListEmptyDark() = WordListShot(dark = true, state = WordListUiState(loading = false))

@PreviewTest
@Preview(showBackground = true)
@Composable
fun CompletionPanelLight() = Themed(false) {
    CompletionPanel(reviewedCount = 3, streak = 2, nextDueDay = 101, today = 100)
}

@PreviewTest
@Preview(showBackground = true, uiMode = UI_MODE_NIGHT_YES)
@Composable
fun CompletionPanelDark() = Themed(true) {
    CompletionPanel(reviewedCount = 3, streak = 2, nextDueDay = 101, today = 100)
}
