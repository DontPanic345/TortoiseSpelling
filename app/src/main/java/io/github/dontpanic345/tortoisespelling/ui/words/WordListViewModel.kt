package io.github.dontpanic345.tortoisespelling.ui.words

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import io.github.dontpanic345.tortoisespelling.data.Word
import io.github.dontpanic345.tortoisespelling.data.WordRepository
import io.github.dontpanic345.tortoisespelling.data.normalizeWord
import io.github.dontpanic345.tortoisespelling.di.AppContainer
import io.github.dontpanic345.tortoisespelling.domain.Days
import io.github.dontpanic345.tortoisespelling.domain.WordFilter
import io.github.dontpanic345.tortoisespelling.domain.matches
import io.github.dontpanic345.tortoisespelling.domain.wordFilterCounts
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class WordRow(val word: Word, val status: String)

data class WordListUiState(
    val query: String = "",
    val filter: WordFilter = WordFilter.ALL,
    val filterCounts: Map<WordFilter, Int> = emptyMap(),
    val rows: List<WordRow> = emptyList(),
    val totalCount: Int = 0,
    val loading: Boolean = true,
) {
    /** True when the query and filter together, not the filter alone, narrow the list. */
    val isFiltering: Boolean get() = query.isNotBlank() || filter != WordFilter.ALL
}

/** Short human-readable scheduling state for the list. */
fun statusLabel(word: Word, today: Long = Days.today()): String = when {
    word.suspended -> "suspended"
    word.isNew -> "new"
    word.dueOn <= today -> "due today"
    else -> Days.relativeLabel(word.dueOn, today)
}

/** The empty state's body when the query and filter together match nothing. */
fun noMatchesBody(query: String, filter: WordFilter): String {
    val filterPhrase = if (filter == WordFilter.ALL) null else "${filter.label.lowercase()} words"
    return when {
        filterPhrase == null -> "Nothing in your list matches “$query”."
        query.isBlank() -> "No $filterPhrase."
        else -> "No $filterPhrase match “$query”."
    }
}

class WordListViewModel(private val repository: WordRepository) : ViewModel() {

    private val _state = MutableStateFlow(WordListUiState())
    val state: StateFlow<WordListUiState> = _state.asStateFlow()

    private var allWords: List<Word> = emptyList()

    init {
        viewModelScope.launch {
            repository.observeWords().collect { words ->
                allWords = words
                val today = Days.today()
                _state.value = _state.value.copy(
                    loading = false,
                    totalCount = words.size,
                    filterCounts = wordFilterCounts(words, today),
                    rows = filtered(words, _state.value.query, _state.value.filter, today),
                )
            }
        }
    }

    fun onQueryChange(query: String) {
        _state.value = _state.value.copy(query = query, rows = filtered(allWords, query, _state.value.filter))
    }

    fun onFilterChange(filter: WordFilter) {
        _state.value = _state.value.copy(filter = filter, rows = filtered(allWords, _state.value.query, filter))
    }

    private fun filtered(
        words: List<Word>,
        query: String,
        filter: WordFilter,
        today: Long = Days.today(),
    ): List<WordRow> {
        val needle = normalizeWord(query)
        return words
            .filter { needle.isEmpty() || it.normalizedText.contains(needle) }
            .filter { filter.matches(it, today) }
            .map { WordRow(it, statusLabel(it, today)) }
    }

    fun toggleSuspended(word: Word) {
        viewModelScope.launch { repository.setSuspended(word, !word.suspended) }
    }

    fun delete(word: Word) {
        viewModelScope.launch { repository.deleteWord(word) }
    }

    companion object {
        fun factory(container: AppContainer): ViewModelProvider.Factory = viewModelFactory {
            initializer { WordListViewModel(container.repository) }
        }
    }
}
