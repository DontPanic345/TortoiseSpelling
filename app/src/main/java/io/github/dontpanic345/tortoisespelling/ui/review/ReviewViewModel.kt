package io.github.dontpanic345.tortoisespelling.ui.review

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import io.github.dontpanic345.tortoisespelling.data.ReviewUndo
import io.github.dontpanic345.tortoisespelling.data.Word
import io.github.dontpanic345.tortoisespelling.data.WordRepository
import io.github.dontpanic345.tortoisespelling.data.normalizeWord
import io.github.dontpanic345.tortoisespelling.di.AppContainer
import io.github.dontpanic345.tortoisespelling.domain.BlankedText
import io.github.dontpanic345.tortoisespelling.domain.ReviewCard
import io.github.dontpanic345.tortoisespelling.domain.SpellingDiff
import io.github.dontpanic345.tortoisespelling.domain.blankWordIn
import io.github.dontpanic345.tortoisespelling.domain.spellingDiff
import io.github.dontpanic345.tortoisespelling.ui.add.EditOutcome
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
    /** The word to open the editor for, from Edit word; cleared by [ReviewViewModel.editOpened]. */
    val openEdit: Long? = null,
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
    private val practiceMode: Boolean,
) : ViewModel() {

    private val _state = MutableStateFlow(ReviewUiState(practiceMode = practiceMode))
    val state: StateFlow<ReviewUiState> = _state.asStateFlow()

    private var advanceJob: Job? = null

    /** The last miss's or hit's write, which the editor must wait for: its save writes the whole row. */
    private var recordJob: Job? = null

    /** What the last [WordRepository.recordReview] returned; null in practice. */
    private var undo: ReviewUndo? = null

    /** The word whose editor this ViewModel opened. */
    private var editedWordId: Long? = null

    /** Guards a double tap on Edit word. */
    private var opening: Job? = null

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
            // still count as a lapse rather than leaving the word untouched. A saved edit
            // from Edit word takes it back (onEditClosed).
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
        recordJob = viewModelScope.launch {
            undo = repository.recordReview(word.id, correctFirstTry, typed)
        }
    }

    /** Edit word, after a miss: opens the editor once the miss is written. */
    fun editWord() {
        val snapshot = _state.value
        val wordId = snapshot.current?.word?.id ?: return
        if (snapshot.phase !is ReviewPhase.Corrective || opening?.isActive == true) {
            return
        }
        editedWordId = wordId
        opening = viewModelScope.launch {
            recordJob?.join()
            _state.update { it.copy(openEdit = wordId) }
        }
    }

    fun editOpened() {
        _state.update { it.copy(openEdit = null) }
    }

    /**
     * The editor closed with [outcome]: a saved edit undoes the miss and asks the word
     * again from its new content; a deleted word leaves the session. Ignored for an editor
     * this ViewModel didn't open, as after process death rebuilt the session.
     */
    fun onEditClosed(outcome: EditOutcome) {
        val wordId = editedWordId ?: return
        editedWordId = null
        if (_state.value.current?.word?.id != wordId) {
            return
        }
        when (outcome) {
            EditOutcome.SAVED -> {
                advanceJob?.cancel()
                _state.update { it.copy(loading = true) }
                viewModelScope.launch {
                    undo?.takeIf { it.wordId == wordId }?.let { repository.undoReview(it) }
                    undo = null
                    val card = repository.cardFor(wordId)
                    if (card == null) {
                        removeCurrent()
                        return@launch
                    }
                    _state.update { snapshot ->
                        snapshot.copy(
                            queue = snapshot.queue.toMutableList().also { it[snapshot.index] = card },
                            loading = false,
                            phase = ReviewPhase.Prompting,
                            input = "",
                        )
                    }
                    markShown(card)
                }
            }

            EditOutcome.DELETED -> removeCurrent()
        }
    }

    /** The current word is gone: the next takes its place, and the total drops with it. */
    private fun removeCurrent() {
        _state.update { snapshot ->
            val queue = snapshot.queue.filterIndexed { i, _ -> i != snapshot.index }
            snapshot.copy(
                queue = queue,
                phase = ReviewPhase.Prompting,
                input = "",
                loading = false,
                finished = snapshot.index >= queue.size,
            )
        }
        _state.value.takeUnless { it.finished }?.current?.let(::markShown)
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
        undo = null
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
                    ReviewViewModel(container.repository, practiceMode)
                }
            }
    }
}
