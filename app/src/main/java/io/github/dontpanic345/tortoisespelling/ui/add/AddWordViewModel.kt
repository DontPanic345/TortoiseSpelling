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
import io.github.dontpanic345.tortoisespelling.data.toContent
import io.github.dontpanic345.tortoisespelling.di.AppContainer
import io.github.dontpanic345.tortoisespelling.domain.ContentEdit
import io.github.dontpanic345.tortoisespelling.domain.ExampleDraft
import io.github.dontpanic345.tortoisespelling.domain.WordContent
import io.github.dontpanic345.tortoisespelling.domain.apply
import io.github.dontpanic345.tortoisespelling.domain.isComplete
import io.github.dontpanic345.tortoisespelling.domain.preparedFor
import io.github.dontpanic345.tortoisespelling.domain.simpleContent
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class AddWordUiState(
    val editingId: Long? = null,
    val text: String = "",
    val content: WordContent = WordContent.blank(),
    val autoRefresh: Boolean = false,
    val lookingUp: Boolean = false,
    val hasApiKey: Boolean = false,
    val message: String? = null,
    val addedThisSession: Int = 0,
    val totalWords: Int = 0,
    val dismissed: Boolean = false,
) {
    val isEditing: Boolean get() = editingId != null
    val canSave: Boolean get() = text.isNotBlank() && content.isComplete()

    /** The root card's fields, which are all the screen edits until the tree editor lands. */
    val definition: String get() = content.definitions.firstOrNull()?.text.orEmpty()
    val partOfSpeech: String get() = content.definitions.firstOrNull()?.partOfSpeech.orEmpty()
    val example: String
        get() = content.definitions.firstOrNull()?.forms?.firstOrNull()?.examples?.firstOrNull()?.text.orEmpty()
    val canLookUp: Boolean get() = text.isNotBlank() && hasApiKey && !lookingUp
}

/**
 * Content the editor can type into: the prepared tree (so a word with no definition or
 * base form still has a first definition and base form) with a blank example to fill
 * when the base form has none.
 */
private fun WordContent.editable(word: String): WordContent {
    val prepared = preparedFor(word)
    val first = prepared.definitions.first()
    val base = first.forms.first()
    if (base.examples.isNotEmpty()) {
        return prepared
    }
    val withExample = base.copy(examples = listOf(ExampleDraft("")))
    return WordContent(
        listOf(first.copy(forms = listOf(withExample) + first.forms.drop(1))) + prepared.definitions.drop(1),
    )
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
        // Both loads run at once, so each must read the state only after its query
        // returns (update); copying _state.value before a suspending call wrote a stale
        // snapshot back and blanked the word the other had just loaded.
        viewModelScope.launch {
            val count = repository.wordCount()
            _state.update { it.copy(totalWords = count) }
        }
        if (editingId != null) {
            viewModelScope.launch {
                repository.contentById(editingId)?.let { loaded ->
                    _state.update {
                        it.copy(
                            text = loaded.word.text,
                            content = loaded.toContent().editable(loaded.word.text),
                            autoRefresh = loaded.word.autoRefresh,
                        )
                    }
                }
            }
        }
    }

    fun onTextChange(value: String) {
        _state.update { it.copy(text = value) }
    }

    fun onEdit(edit: ContentEdit) {
        _state.update { it.copy(content = it.content.apply(edit)) }
    }

    fun onAutoRefreshChange(value: Boolean) {
        _state.update { it.copy(autoRefresh = value) }
    }

    fun consumeMessage() {
        _state.update { it.copy(message = null) }
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
                    _state.update {
                        it.copy(
                            lookingUp = false,
                            text = result.word,
                            content = simpleContent(
                                word = result.word,
                                definition = result.definition,
                                partOfSpeech = result.partOfSpeech,
                                example = result.example,
                            ).editable(result.word),
                            message = if (corrected) {
                                "Corrected spelling to “${result.word}”."
                            } else {
                                null
                            },
                        )
                    }
                }

                // Lenient by design: hand back whatever came back rather than discarding
                // it, so the user can salvage it instead of retyping from scratch.
                is LookupResult.Unparsed -> _state.update {
                    it.copy(
                        lookingUp = false,
                        content = it.content.apply(ContentEdit.DefinitionText(0, result.rawText)),
                        message = "Claude didn't return the expected format — edit as needed.",
                    )
                }

                is LookupResult.Refused -> _state.update {
                    it.copy(
                        lookingUp = false,
                        message = result.message,
                    )
                }

                is LookupResult.Failure -> _state.update {
                    it.copy(
                        lookingUp = false,
                        message = result.message,
                    )
                }
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
                    existing.copy(text = snapshot.text, autoRefresh = snapshot.autoRefresh),
                    snapshot.content,
                )
                _state.value = when (result) {
                    UpdateResult.Updated -> _state.value.copy(dismissed = true)
                    is UpdateResult.Duplicate -> _state.value.copy(
                        message = "“${result.existing.text}” is already in your list.",
                    )
                }
                return@launch
            }

            when (val result = repository.addWord(snapshot.text, snapshot.content, snapshot.autoRefresh)) {
                is AddResult.Added -> {
                    val total = repository.wordCount()
                    // Stay on the screen with the fields cleared: adding words happens in
                    // bursts, and bouncing back home after each one is friction.
                    _state.value = AddWordUiState(
                        hasApiKey = snapshot.hasApiKey,
                        // Carried over, not reset: words are added in bursts, and the
                        // whole burst usually wants the same answer.
                        autoRefresh = snapshot.autoRefresh,
                        addedThisSession = snapshot.addedThisSession + 1,
                        totalWords = total,
                        message = "Added ✓ ($total total)",
                    )
                }

                is AddResult.Duplicate -> _state.update {
                    it.copy(
                        message = "“${result.existing.text}” is already in your list.",
                    )
                }

                AddResult.Blank -> _state.update {
                    it.copy(
                        message = "Type a word first.",
                    )
                }
            }
        }
    }

    fun delete() {
        val editingId = _state.value.editingId ?: return
        viewModelScope.launch {
            repository.wordById(editingId)?.let { repository.deleteWord(it) }
            _state.update { it.copy(dismissed = true) }
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
