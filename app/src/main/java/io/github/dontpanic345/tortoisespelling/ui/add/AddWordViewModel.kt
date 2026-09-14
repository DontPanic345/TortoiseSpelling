package io.github.dontpanic345.tortoisespelling.ui.add

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import io.github.dontpanic345.tortoisespelling.data.AddResult
import io.github.dontpanic345.tortoisespelling.data.SettingsStore
import io.github.dontpanic345.tortoisespelling.data.UpdateResult
import io.github.dontpanic345.tortoisespelling.data.WordRepository
import io.github.dontpanic345.tortoisespelling.data.remote.ClaudeClient
import io.github.dontpanic345.tortoisespelling.data.remote.LookupResult
import io.github.dontpanic345.tortoisespelling.di.AppContainer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

data class AddWordUiState(
    val editingId: Long? = null,
    val text: String = "",
    val definition: String = "",
    val example: String = "",
    val partOfSpeech: String = "",
    val lookingUp: Boolean = false,
    val hasApiKey: Boolean = false,
    val message: String? = null,
    val addedThisSession: Int = 0,
    val totalWords: Int = 0,
    val dismissed: Boolean = false,
) {
    val isEditing: Boolean get() = editingId != null
    val canSave: Boolean get() = text.isNotBlank() && definition.isNotBlank()
    val canLookUp: Boolean get() = text.isNotBlank() && hasApiKey && !lookingUp
}

class AddWordViewModel(
    private val repository: WordRepository,
    private val settings: SettingsStore,
    private val claude: ClaudeClient,
    editingId: Long?,
) : ViewModel() {

    private val _state = MutableStateFlow(
        AddWordUiState(
            editingId = editingId,
            hasApiKey = settings.current().hasApiKey,
        ),
    )
    val state: StateFlow<AddWordUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            _state.value = _state.value.copy(totalWords = repository.observeWordCount().first())
        }
        if (editingId != null) {
            viewModelScope.launch {
                repository.wordById(editingId)?.let { word ->
                    _state.value = _state.value.copy(
                        text = word.text,
                        definition = word.definition,
                        example = word.example,
                        partOfSpeech = word.partOfSpeech.orEmpty(),
                    )
                }
            }
        }
    }

    fun onTextChange(value: String) {
        _state.value = _state.value.copy(text = value)
    }

    fun onDefinitionChange(value: String) {
        _state.value = _state.value.copy(definition = value)
    }

    fun onExampleChange(value: String) {
        _state.value = _state.value.copy(example = value)
    }

    fun onPartOfSpeechChange(value: String) {
        _state.value = _state.value.copy(partOfSpeech = value)
    }

    fun consumeMessage() {
        _state.value = _state.value.copy(message = null)
    }

    fun lookUp() {
        val snapshot = _state.value
        val word = snapshot.text.trim()
        if (word.isEmpty()) {
            return
        }
        val config = settings.current()
        if (!config.hasApiKey) {
            _state.value = snapshot.copy(message = "Add your API key in Settings first.")
            return
        }

        _state.value = snapshot.copy(lookingUp = true)
        viewModelScope.launch {
            when (val result = claude.lookup(word, config.apiKey)) {
                is LookupResult.Success -> {
                    // Claude returns the corrected spelling; adopt it so the card teaches
                    // the right word, not the typo. The user can still edit it back.
                    val corrected = !result.word.equals(word, ignoreCase = true)
                    _state.value = _state.value.copy(
                        lookingUp = false,
                        text = result.word,
                        definition = result.definition,
                        example = result.example,
                        partOfSpeech = result.partOfSpeech.orEmpty(),
                        message = if (corrected) {
                            "Corrected spelling to “${result.word}”."
                        } else {
                            null
                        },
                    )
                }

                // Lenient by design: hand back whatever came back rather than discarding
                // it, so the user can salvage it instead of retyping from scratch.
                is LookupResult.Unparsed -> _state.value = _state.value.copy(
                    lookingUp = false,
                    definition = result.rawText,
                    message = "Claude didn't return the expected format — edit as needed.",
                )

                is LookupResult.Refused -> _state.value = _state.value.copy(
                    lookingUp = false,
                    message = result.message,
                )

                is LookupResult.Failure -> _state.value = _state.value.copy(
                    lookingUp = false,
                    message = result.message,
                )
            }
        }
    }

    fun save() {
        val snapshot = _state.value
        if (!snapshot.canSave) {
            return
        }
        viewModelScope.launch {
            val editingId = snapshot.editingId
            if (editingId != null) {
                val existing = repository.wordById(editingId) ?: return@launch
                val result = repository.updateWord(
                    existing.copy(
                        text = snapshot.text,
                        definition = snapshot.definition,
                        example = snapshot.example,
                        partOfSpeech = snapshot.partOfSpeech.ifBlank { null },
                    ),
                )
                _state.value = when (result) {
                    UpdateResult.Updated -> _state.value.copy(dismissed = true)
                    is UpdateResult.Duplicate -> _state.value.copy(
                        message = "“${result.existing.text}” is already in your list.",
                    )
                }
                return@launch
            }

            when (val result = repository.addWord(
                text = snapshot.text,
                definition = snapshot.definition,
                example = snapshot.example,
                partOfSpeech = snapshot.partOfSpeech.ifBlank { null },
            )) {
                is AddResult.Added -> {
                    val total = repository.observeWordCount().first()
                    // Stay on the screen with the fields cleared: adding words happens in
                    // bursts, and bouncing back home after each one is friction.
                    _state.value = AddWordUiState(
                        hasApiKey = snapshot.hasApiKey,
                        addedThisSession = snapshot.addedThisSession + 1,
                        totalWords = total,
                        message = "Added ✓ ($total total)",
                    )
                }

                is AddResult.Duplicate -> _state.value = _state.value.copy(
                    message = "“${result.existing.text}” is already in your list.",
                )

                AddResult.Blank -> _state.value = _state.value.copy(
                    message = "Type a word first.",
                )
            }
        }
    }

    fun delete() {
        val editingId = _state.value.editingId ?: return
        viewModelScope.launch {
            repository.wordById(editingId)?.let { repository.deleteWord(it) }
            _state.value = _state.value.copy(dismissed = true)
        }
    }

    companion object {
        fun factory(container: AppContainer, editingId: Long?): ViewModelProvider.Factory =
            viewModelFactory {
                initializer {
                    AddWordViewModel(
                        container.repository,
                        container.settings,
                        container.claude,
                        editingId,
                    )
                }
            }
    }
}
