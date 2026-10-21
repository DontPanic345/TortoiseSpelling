package io.github.dontpanic345.tortoisespelling.ui.add

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import io.github.dontpanic345.tortoisespelling.data.AddResult
import io.github.dontpanic345.tortoisespelling.data.UpdateResult
import io.github.dontpanic345.tortoisespelling.data.WordRepository
import io.github.dontpanic345.tortoisespelling.data.toContent
import io.github.dontpanic345.tortoisespelling.di.AppContainer
import io.github.dontpanic345.tortoisespelling.domain.ContentEdit
import io.github.dontpanic345.tortoisespelling.domain.ExampleDraft
import io.github.dontpanic345.tortoisespelling.domain.PastedLookup
import io.github.dontpanic345.tortoisespelling.domain.WordContent
import io.github.dontpanic345.tortoisespelling.domain.apply
import io.github.dontpanic345.tortoisespelling.domain.isComplete
import io.github.dontpanic345.tortoisespelling.domain.parsePastedLookup
import io.github.dontpanic345.tortoisespelling.domain.preparedFor
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** How the edit screen closed: the edit was saved, or the word deleted. */
enum class EditOutcome { SAVED, DELETED }

/** The paste dialog's text and what [parsePastedLookup] made of it; [result] is null while the text is blank. */
data class PasteDraft(val text: String = "", val result: PastedLookup? = null)

data class AddWordUiState(
    val editingId: Long? = null,
    val text: String = "",
    val content: WordContent = WordContent.blank(),
    val paste: PasteDraft? = null,
    val message: String? = null,
    val addedThisSession: Int = 0,
    val totalWords: Int = 0,
    /** Set when editing ends; adding never closes the screen. */
    val closed: EditOutcome? = null,
) {
    val isEditing: Boolean get() = editingId != null
    val canSave: Boolean get() = text.isNotBlank() && content.isComplete()

    val canCopyPrompt: Boolean get() = text.isNotBlank()

    /** The state after the user accepts a pasted answer: its spelling and content replace the editor's. */
    fun applying(answer: PastedLookup.Valid): AddWordUiState = copy(
        text = answer.word,
        content = answer.content,
        paste = null,
        message = if (answer.renames) "Corrected spelling to “${answer.word}”." else message,
    )
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
    editingId: Long?,
) : ViewModel() {

    private val _state = MutableStateFlow(AddWordUiState(editingId = editingId))
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

    fun consumeMessage() {
        _state.update { it.copy(message = null) }
    }

    fun openPaste() {
        _state.update { it.copy(paste = PasteDraft()) }
    }

    fun onPasteTextChange(value: String) {
        _state.update {
            it.copy(
                paste = PasteDraft(
                    text = value,
                    result = if (value.isBlank()) null else parsePastedLookup(value, it.text),
                ),
            )
        }
    }

    fun usePaste() {
        _state.update {
            val result = it.paste?.result
            if (result is PastedLookup.Valid) it.applying(result) else it
        }
    }

    fun dismissPaste() {
        _state.update { it.copy(paste = null) }
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
                    existing.copy(text = snapshot.text),
                    snapshot.content,
                )
                _state.value = when (result) {
                    UpdateResult.Updated -> _state.value.copy(closed = EditOutcome.SAVED)
                    is UpdateResult.Duplicate -> _state.value.copy(
                        message = "“${result.existing.text}” is already in your list.",
                    )
                }
                return@launch
            }

            when (val result = repository.addWord(snapshot.text, snapshot.content)) {
                is AddResult.Added -> {
                    val total = repository.wordCount()
                    // Stay on the screen with the fields cleared: adding words happens in
                    // bursts, and bouncing back home after each one is friction.
                    _state.value = AddWordUiState(
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
            _state.update { it.copy(closed = EditOutcome.DELETED) }
        }
    }

    companion object {
        fun factory(container: AppContainer, editingId: Long?): ViewModelProvider.Factory =
            viewModelFactory {
                initializer {
                    AddWordViewModel(
                        container.repository,
                        editingId,
                    )
                }
            }
    }
}
