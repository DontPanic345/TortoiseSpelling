package com.falloon.tortoisespelling.ui.words

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.falloon.tortoisespelling.data.Word
import com.falloon.tortoisespelling.data.WordRepository
import com.falloon.tortoisespelling.data.normalizeWord
import com.falloon.tortoisespelling.di.AppContainer
import com.falloon.tortoisespelling.domain.Days
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class WordRow(val word: Word, val status: String)

data class WordListUiState(
    val query: String = "",
    val rows: List<WordRow> = emptyList(),
    val totalCount: Int = 0,
    val loading: Boolean = true,
) {
    val isFiltering: Boolean get() = query.isNotBlank()
}

/** Short human-readable scheduling state for the list. */
fun statusLabel(word: Word, today: Long = Days.today()): String = when {
    word.suspended -> "suspended"
    word.isNew -> "new"
    word.dueOn <= today -> "due today"
    else -> Days.relativeLabel(word.dueOn, today)
}

class WordListViewModel(private val repository: WordRepository) : ViewModel() {

    private val _state = MutableStateFlow(WordListUiState())
    val state: StateFlow<WordListUiState> = _state.asStateFlow()

    private var allWords: List<Word> = emptyList()

    init {
        viewModelScope.launch {
            repository.observeWords().collect { words ->
                allWords = words
                _state.value = _state.value.copy(
                    loading = false,
                    totalCount = words.size,
                    rows = filtered(words, _state.value.query),
                )
            }
        }
    }

    fun onQueryChange(query: String) {
        _state.value = _state.value.copy(query = query, rows = filtered(allWords, query))
    }

    private fun filtered(words: List<Word>, query: String): List<WordRow> {
        val needle = normalizeWord(query)
        val today = Days.today()
        return words
            .filter { needle.isEmpty() || it.normalizedText.contains(needle) }
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
