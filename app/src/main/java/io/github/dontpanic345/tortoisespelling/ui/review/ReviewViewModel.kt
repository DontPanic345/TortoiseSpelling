package io.github.dontpanic345.tortoisespelling.ui.review

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import io.github.dontpanic345.tortoisespelling.data.CardRefresher
import io.github.dontpanic345.tortoisespelling.data.Word
import io.github.dontpanic345.tortoisespelling.data.WordRepository
import io.github.dontpanic345.tortoisespelling.data.normalizeWord
import io.github.dontpanic345.tortoisespelling.di.AppContainer
import io.github.dontpanic345.tortoisespelling.domain.BlankedText
import io.github.dontpanic345.tortoisespelling.domain.ReviewCard
import io.github.dontpanic345.tortoisespelling.domain.SpellingDiff
import io.github.dontpanic345.tortoisespelling.domain.blankWordIn
import io.github.dontpanic345.tortoisespelling.domain.spellingDiff
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Where the user is on the current word. */
sealed interface ReviewPhase {
    /** Typing the first attempt. */
    data object Prompting : ReviewPhase

    /** Got it unaided; the word and full sentence are revealed. */
    data object Correct : ReviewPhase

    /**
     * Missed it. The answer stays hidden while the learner has another go from memory;
     * [revealed] once they ask for it or miss again. After that a clean retype is
     * required before moving on — the corrective repetition, and it is not skippable.
     */
    data class Corrective(
        val attempt: String,
        val diff: SpellingDiff,
        val revealed: Boolean,
        val retypeMissed: Boolean,
    ) : ReviewPhase
}

data class ReviewUiState(
    val loading: Boolean = true,
    val queue: List<ReviewCard> = emptyList(),
    val index: Int = 0,
    val input: String = "",
    val phase: ReviewPhase = ReviewPhase.Prompting,
    val finished: Boolean = false,
    val practiceMode: Boolean = false,
) {
    val current: ReviewCard? get() = queue.getOrNull(index)
    val total: Int get() = queue.size
    val position: Int get() = (index + 1).coerceAtMost(total)

    /**
     * The last word has been answered, so the session is about to close itself.
     * Nothing more can be pressed here: the auto-advance is the end of the session.
     */
    val ending: Boolean get() = phase == ReviewPhase.Correct && index == queue.lastIndex

    /** The example sentence with the asked form masked, when it can be found in it. */
    val blankedExample: BlankedText?
        get() = current?.let { card ->
            card.example?.text?.takeIf { it.isNotBlank() }?.let { blankWordIn(it, card.form) }
        }
}

class ReviewViewModel(
    private val repository: WordRepository,
    private val cardRefresher: CardRefresher,
    private val practiceMode: Boolean,
) : ViewModel() {

    private val _state = MutableStateFlow(ReviewUiState(practiceMode = practiceMode))
    val state: StateFlow<ReviewUiState> = _state.asStateFlow()

    private var advanceJob: Job? = null

    init {
        viewModelScope.launch {
            val queue = if (practiceMode) repository.practicePool() else repository.buildSession()
            _state.update {
                it.copy(
                    loading = false,
                    queue = queue,
                    finished = queue.isEmpty(),
                )
            }
            // Rewrite the flagged cards for next time. Not in practice mode: practice
            // is an ad-hoc dip into random words, and it already leaves the rest of a
            // word's state alone. Fire and forget — this session shows today's cards
            // either way, and the work outlives the ViewModel.
            if (!practiceMode) {
                cardRefresher.refreshInBackground(queue.map { it.word })
            }
            queue.firstOrNull()?.let(::markShown)
        }
    }

    fun onInputChange(value: String) {
        _state.update { it.copy(input = value) }
    }

    fun submit() {
        val snapshot = _state.value
        val card = snapshot.current ?: return
        val typed = snapshot.input.trim()
        if (typed.isEmpty()) {
            return
        }

        when (snapshot.phase) {
            ReviewPhase.Prompting -> gradeFirstAttempt(card, typed)
            is ReviewPhase.Corrective -> if (snapshot.phase.revealed) {
                checkRetype(snapshot.phase, card, typed)
            } else {
                gradeSecondAttempt(card, typed)
            }
            ReviewPhase.Correct -> advance()
        }
    }

    private fun gradeFirstAttempt(card: ReviewCard, typed: String) {
        if (normalizeWord(typed) == card.answer) {
            markCorrect(card)
            record(card.word, correctFirstTry = true, typed = typed)
        } else {
            _state.update {
                it.copy(
                    phase = ReviewPhase.Corrective(
                        attempt = typed,
                        diff = spellingDiff(card.form, typed),
                        revealed = false,
                        retypeMissed = false,
                    ),
                    input = "",
                )
            }
            // Recorded at the miss, not at the retype: abandoning mid-correction should
            // still count as a lapse rather than leaving the word untouched.
            record(card.word, correctFirstTry = false, typed = typed)
        }
    }

    /** Already recorded as a miss at the first attempt, so this only decides what shows. */
    private fun gradeSecondAttempt(card: ReviewCard, typed: String) {
        if (normalizeWord(typed) == card.answer) {
            markCorrect(card)
        } else {
            _state.update {
                it.copy(
                    phase = ReviewPhase.Corrective(
                        attempt = typed,
                        diff = spellingDiff(card.form, typed),
                        revealed = true,
                        retypeMissed = false,
                    ),
                    input = "",
                )
            }
        }
    }

    fun showAnswer() {
        _state.update { snapshot ->
            val phase = snapshot.phase
            if (phase is ReviewPhase.Corrective) {
                snapshot.copy(phase = phase.copy(revealed = true))
            } else {
                snapshot
            }
        }
    }

    private fun markCorrect(card: ReviewCard) {
        _state.update { it.copy(phase = ReviewPhase.Correct, input = card.form) }
        scheduleAutoAdvance(_state.value.index)
    }

    private fun checkRetype(phase: ReviewPhase.Corrective, card: ReviewCard, typed: String) {
        if (normalizeWord(typed) == card.answer) {
            advance()
        } else {
            _state.update {
                it.copy(
                    phase = phase.copy(retypeMissed = true),
                    input = "",
                )
            }
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

    /** Rotation: the sentence on screen counts as shown, in practice mode too. */
    private fun markShown(card: ReviewCard) {
        val example = card.example ?: return
        viewModelScope.launch { repository.markShown(example) }
    }

    fun advance() {
        advanceJob?.cancel()
        _state.update { snapshot ->
            val next = snapshot.index + 1
            snapshot.copy(
                index = next,
                input = "",
                phase = ReviewPhase.Prompting,
                finished = next >= snapshot.queue.size,
            )
        }
        _state.value.takeUnless { it.finished }?.current?.let(::markShown)
    }

    companion object {
        const val AUTO_ADVANCE_MILLIS = 1100L

        fun factory(container: AppContainer, practiceMode: Boolean): ViewModelProvider.Factory =
            viewModelFactory {
                initializer {
                    ReviewViewModel(container.repository, container.cardRefresher, practiceMode)
                }
            }
    }
}
