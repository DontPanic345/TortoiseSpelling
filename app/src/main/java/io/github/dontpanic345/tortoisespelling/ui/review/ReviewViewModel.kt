package io.github.dontpanic345.tortoisespelling.ui.review

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import io.github.dontpanic345.tortoisespelling.data.SettingsStore
import io.github.dontpanic345.tortoisespelling.data.Word
import io.github.dontpanic345.tortoisespelling.data.WordRepository
import io.github.dontpanic345.tortoisespelling.data.normalizeWord
import io.github.dontpanic345.tortoisespelling.data.remote.ClaudeClient
import io.github.dontpanic345.tortoisespelling.data.remote.LookupResult
import io.github.dontpanic345.tortoisespelling.data.remote.StaleCard
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
import kotlinx.coroutines.flow.update
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
    val hasApiKey: Boolean = false,
    val refreshing: Boolean = false,
    val message: String? = null,
) {
    val current: Word? get() = queue.getOrNull(index)
    val total: Int get() = queue.size
    val position: Int get() = (index + 1).coerceAtMost(total)

    /** The example sentence with the target word masked, when it can be found in it. */
    val blankedExample: BlankedText?
        get() = current?.let { word ->
            if (word.example.isBlank()) null else blankWordIn(word.example, word.text)
        }

    /** Whether the card on screen can be handed back to Claude to be rewritten. */
    val canRefresh: Boolean get() = hasApiKey && !refreshing && !loading && current != null
}

class ReviewViewModel(
    private val repository: WordRepository,
    private val settings: SettingsStore,
    private val claude: ClaudeClient,
    private val practiceMode: Boolean,
) : ViewModel() {

    private val _state = MutableStateFlow(ReviewUiState(practiceMode = practiceMode))
    val state: StateFlow<ReviewUiState> = _state.asStateFlow()

    private var advanceJob: Job? = null

    init {
        viewModelScope.launch {
            val queue = if (practiceMode) repository.practicePool() else repository.buildSession()
            // update, not copy-of-a-snapshot: the settings collector below writes to the
            // same state and either load can land first.
            _state.update {
                it.copy(loading = false, queue = queue, finished = queue.isEmpty())
            }
        }
        // Collected rather than read once, so adding a key in Settings and coming back
        // makes the refresh action appear without restarting the session.
        viewModelScope.launch {
            settings.settings.collect { config ->
                _state.update { it.copy(hasApiKey = config.hasApiKey) }
            }
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

    fun consumeMessage() {
        _state.update { it.copy(message = null) }
    }

    /**
     * Have Claude rewrite the card on screen, and save what comes back.
     *
     * This is for a word that has survived enough reviews for its example to wear out.
     * The rewrite is persisted, so it is also what the word looks like next time round;
     * a throwaway sentence would leave the stale one in place.
     *
     * Available in any phase, mid-attempt included — that is when a tired prompt is
     * actually in front of the user. It can't hand over the answer: the definition is
     * scrubbed of the word on the way into the database, and the example is blanked on
     * the way onto the screen. Practice mode refreshes too; a card's wording is content,
     * not the scheduling state practice mode leaves alone.
     */
    fun refreshCard() {
        val snapshot = _state.value
        val word = snapshot.current ?: return
        if (snapshot.refreshing) {
            return
        }
        val config = settings.current()
        if (!config.hasApiKey) {
            _state.update {
                it.copy(hasApiKey = false, message = "Add your API key in Settings first.")
            }
            return
        }
        // A correct answer is on a 1.1s fuse; don't let the session advance out from
        // under the rewrite the user just asked for.
        advanceJob?.cancel()
        _state.update { it.copy(refreshing = true) }

        viewModelScope.launch {
            val result = claude.lookup(
                word = word.text,
                apiKey = config.apiKey,
                stale = StaleCard(definition = word.definition, example = word.example),
            )
            val message = when (result) {
                is LookupResult.Success -> applyRefresh(word, result)
                // Unlike the add screen there is no field to salvage raw text into, so a
                // mangled answer leaves the existing card alone.
                is LookupResult.Unparsed ->
                    "Claude didn't return the expected format — the card is unchanged."
                is LookupResult.Refused -> "Claude declined this word — the card is unchanged."
                is LookupResult.Failure -> result.message
            }
            _state.update { it.copy(refreshing = false, message = message) }
        }
    }

    /** Save a rewritten card and put it back in the queue. Returns the message to show. */
    private suspend fun applyRefresh(word: Word, result: LookupResult.Success): String? {
        // Only what actually came back is replaced, so a half-empty answer can't wipe a
        // definition that was fine. result.word is ignored on purpose: this row already
        // exists under its spelling, and a refresh is not a rename.
        val definition = result.definition.ifBlank { word.definition }
        val example = result.example.ifBlank { word.example }
        if (definition == word.definition && example == word.example) {
            return "Claude came back with the same card — try again."
        }
        val updated = repository.replaceContent(
            word = word,
            definition = definition,
            example = example,
            partOfSpeech = result.partOfSpeech ?: word.partOfSpeech,
        )
        // By id, not by index: the user may well have moved on while this was in flight.
        _state.update { state ->
            state.copy(queue = state.queue.map { if (it.id == updated.id) updated else it })
        }
        return null
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
                initializer {
                    ReviewViewModel(
                        container.repository,
                        container.settings,
                        container.claude,
                        practiceMode,
                    )
                }
            }
    }
}
