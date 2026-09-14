package io.github.dontpanic345.tortoisespelling.ui.review

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import io.github.dontpanic345.tortoisespelling.data.Word
import io.github.dontpanic345.tortoisespelling.data.WordRepository
import io.github.dontpanic345.tortoisespelling.data.normalizeWord
import io.github.dontpanic345.tortoisespelling.di.AppContainer
import io.github.dontpanic345.tortoisespelling.domain.BlankedText
import io.github.dontpanic345.tortoisespelling.domain.SpellingDiff
import io.github.dontpanic345.tortoisespelling.domain.blankWordIn
import io.github.dontpanic345.tortoisespelling.domain.spellingDiff
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** Where the user is on the current word. */
sealed interface ReviewPhase {
    /** Typing the first attempt. */
    data object Prompting : ReviewPhase

    /** Got it unaided; the word and full sentence are revealed. */
    data object Correct : ReviewPhase

    /**
     * Missed it. The answer is shown and a clean retype is required before moving on —
     * this is the corrective repetition, and it is not skippable.
     */
    data class Corrective(val attempt: String, val diff: SpellingDiff, val retypeMissed: Boolean) :
        ReviewPhase
}

data class ReviewUiState(
    val loading: Boolean = true,
    val queue: List<Word> = emptyList(),
    val index: Int = 0,
    val input: String = "",
    val phase: ReviewPhase = ReviewPhase.Prompting,
    val finished: Boolean = false,
    val practiceMode: Boolean = false,
) {
    val current: Word? get() = queue.getOrNull(index)
    val total: Int get() = queue.size
    val position: Int get() = (index + 1).coerceAtMost(total)

    /** The example sentence with the target word masked, when it can be found in it. */
    val blankedExample: BlankedText?
        get() = current?.let { word ->
            if (word.example.isBlank()) null else blankWordIn(word.example, word.text)
        }
}

class ReviewViewModel(
    private val repository: WordRepository,
    private val practiceMode: Boolean,
) : ViewModel() {

    private val _state = MutableStateFlow(ReviewUiState(practiceMode = practiceMode))
    val state: StateFlow<ReviewUiState> = _state.asStateFlow()

    private var advanceJob: Job? = null

    init {
        viewModelScope.launch {
            val queue = if (practiceMode) repository.practicePool() else repository.buildSession()
            _state.value = _state.value.copy(
                loading = false,
                queue = queue,
                finished = queue.isEmpty(),
            )
        }
    }

    fun onInputChange(value: String) {
        _state.value = _state.value.copy(input = value)
    }

    fun submit() {
        val snapshot = _state.value
        val word = snapshot.current ?: return
        val typed = snapshot.input.trim()
        if (typed.isEmpty()) {
            return
        }

        when (snapshot.phase) {
            ReviewPhase.Prompting -> gradeFirstAttempt(word, typed)
            is ReviewPhase.Corrective -> checkRetype(snapshot.phase, word, typed)
            ReviewPhase.Correct -> advance()
        }
    }

    private fun gradeFirstAttempt(word: Word, typed: String) {
        if (normalizeWord(typed) == word.normalizedText) {
            _state.value = _state.value.copy(phase = ReviewPhase.Correct, input = word.text)
            record(word, correctFirstTry = true, typed = typed)
            scheduleAutoAdvance(_state.value.index)
        } else {
            _state.value = _state.value.copy(
                phase = ReviewPhase.Corrective(
                    attempt = typed,
                    diff = spellingDiff(word.text, typed),
                    retypeMissed = false,
                ),
                input = "",
            )
            // Recorded at the miss, not at the retype: abandoning mid-correction should
            // still count as a lapse rather than leaving the word untouched.
            record(word, correctFirstTry = false, typed = typed)
        }
    }

    private fun checkRetype(phase: ReviewPhase.Corrective, word: Word, typed: String) {
        if (normalizeWord(typed) == word.normalizedText) {
            advance()
        } else {
            _state.value = _state.value.copy(
                phase = phase.copy(retypeMissed = true),
                input = "",
            )
        }
    }

    private fun record(word: Word, correctFirstTry: Boolean, typed: String) {
        if (practiceMode) {
            return
        }
        viewModelScope.launch { repository.recordReview(word, correctFirstTry, typed) }
    }

    /** Give a correct answer a beat on screen, but never block on it. */
    private fun scheduleAutoAdvance(forIndex: Int) {
        advanceJob?.cancel()
        advanceJob = viewModelScope.launch {
            delay(AUTO_ADVANCE_MILLIS)
            val snapshot = _state.value
            if (snapshot.index == forIndex && snapshot.phase == ReviewPhase.Correct) {
                advance()
            }
        }
    }

    fun advance() {
        advanceJob?.cancel()
        val snapshot = _state.value
        val next = snapshot.index + 1
        _state.value = snapshot.copy(
            index = next,
            input = "",
            phase = ReviewPhase.Prompting,
            finished = next >= snapshot.queue.size,
        )
    }

    companion object {
        const val AUTO_ADVANCE_MILLIS = 1100L

        fun factory(container: AppContainer, practiceMode: Boolean): ViewModelProvider.Factory =
            viewModelFactory {
                initializer { ReviewViewModel(container.repository, practiceMode) }
            }
    }
}
