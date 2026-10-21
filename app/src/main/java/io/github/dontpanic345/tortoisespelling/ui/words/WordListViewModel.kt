package io.github.dontpanic345.tortoisespelling.ui.words

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import io.github.dontpanic345.tortoisespelling.data.Word
import io.github.dontpanic345.tortoisespelling.data.WordRepository
import io.github.dontpanic345.tortoisespelling.data.WordWithContent
import io.github.dontpanic345.tortoisespelling.data.normalizeWord
import io.github.dontpanic345.tortoisespelling.data.sorted
import io.github.dontpanic345.tortoisespelling.data.toContent
import io.github.dontpanic345.tortoisespelling.di.AppContainer
import io.github.dontpanic345.tortoisespelling.domain.Days
import io.github.dontpanic345.tortoisespelling.domain.WordFilter
import io.github.dontpanic345.tortoisespelling.domain.formWarnings
import io.github.dontpanic345.tortoisespelling.domain.matches
import io.github.dontpanic345.tortoisespelling.domain.searchTerms
import io.github.dontpanic345.tortoisespelling.domain.wordFilterCounts
import java.time.Clock
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class WordRow(
    val word: Word,
    val status: String,
    val definition: String,
    val checkForms: Boolean = false,
)

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
fun statusLabel(word: Word, today: Long): String = when {
    word.suspended -> "suspended"
    word.isNew -> "new"
    word.dueOn <= today -> "due today"
    else -> Days.relativeLabel(word.dueOn, today)
}

/** The rows matching [filter] and a query that is a substring of the root or of any form's spelling. */
fun filterRows(
    words: List<WordWithContent>,
    query: String,
    filter: WordFilter,
    today: Long,
): List<WordRow> {
    val needle = normalizeWord(query)
    return words
        .filter { needle.isEmpty() || it.toContent().searchTerms(it.word.text).any { term -> term.contains(needle) } }
        .filter { filter.matches(it.word, today) }
        .map { content ->
            val definition = content.sorted().definitions.firstOrNull()?.definition?.text.orEmpty()
            val checkForms = formWarnings(content.word.text, content.toContent()).isNotEmpty()
            WordRow(content.word, statusLabel(content.word, today), definition, checkForms)
        }
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

class WordListViewModel(
    private val repository: WordRepository,
    private val clock: Clock,
) : ViewModel() {

    private val _state = MutableStateFlow(WordListUiState())
    val state: StateFlow<WordListUiState> = _state.asStateFlow()

    private var allWords: List<WordWithContent> = emptyList()

    init {
        viewModelScope.launch {
            repository.observeWordsWithContent().collect { words ->
                allWords = words
                val today = Days.today(clock)
                _state.update {
                    it.copy(
                        loading = false,
                        totalCount = words.size,
                        filterCounts = wordFilterCounts(words.map { it.word }, today),
                        rows = filtered(words, it.query, it.filter, today),
                    )
                }
            }
        }
    }

    fun onQueryChange(query: String) {
        _state.update { it.copy(query = query, rows = filtered(allWords, query, it.filter, Days.today(clock))) }
    }

    fun onFilterChange(filter: WordFilter) {
        _state.update { it.copy(filter = filter, rows = filtered(allWords, it.query, filter, Days.today(clock))) }
    }

    private fun filtered(
        words: List<WordWithContent>,
        query: String,
        filter: WordFilter,
        today: Long,
    ): List<WordRow> = filterRows(words, query, filter, today)

    fun toggleSuspended(word: Word) {
        viewModelScope.launch { repository.setSuspended(word, !word.suspended) }
    }

    fun delete(word: Word) {
        viewModelScope.launch { repository.deleteWord(word) }
    }

    companion object {
        fun factory(container: AppContainer): ViewModelProvider.Factory = viewModelFactory {
            initializer { WordListViewModel(container.repository, container.clock) }
        }
    }
}
