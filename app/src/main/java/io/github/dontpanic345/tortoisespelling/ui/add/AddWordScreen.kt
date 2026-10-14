package io.github.dontpanic345.tortoisespelling.ui.add

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import io.github.dontpanic345.tortoisespelling.domain.ContentEdit
import io.github.dontpanic345.tortoisespelling.domain.DefinitionDraft
import io.github.dontpanic345.tortoisespelling.domain.FormDraft
import io.github.dontpanic345.tortoisespelling.domain.exampleMissesForm
import io.github.dontpanic345.tortoisespelling.ui.BackButton
import io.github.dontpanic345.tortoisespelling.ui.TestTags
import io.github.dontpanic345.tortoisespelling.ui.rememberAppContainer

@Composable
fun AddWordScreen(
    editingId: Long?,
    onDone: () -> Unit,
) {
    val container = rememberAppContainer()
    val viewModel: AddWordViewModel = viewModel(
        key = "add-${editingId ?: "new"}",
        factory = AddWordViewModel.factory(container, editingId),
    )
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbarHost = remember { SnackbarHostState() }
    val wordFocus = remember { FocusRequester() }

    LaunchedEffect(state.dismissed) {
        if (state.dismissed) {
            onDone()
        }
    }

    LaunchedEffect(state.message) {
        state.message?.let { message ->
            snackbarHost.showSnackbar(message)
            viewModel.consumeMessage()
        }
    }

    // After a save the fields clear and focus returns to the word field, so a run of
    // words can be added without reaching for anything.
    LaunchedEffect(state.addedThisSession) {
        runCatching { wordFocus.requestFocus() }
    }

    AddWordContent(
        state = state,
        snackbarHost = snackbarHost,
        wordFocus = wordFocus,
        onBack = onDone,
        onDelete = viewModel::delete,
        onTextChange = viewModel::onTextChange,
        onLookUp = viewModel::lookUp,
        onEdit = viewModel::onEdit,
        onAutoRefreshChange = viewModel::onAutoRefreshChange,
        onSave = viewModel::save,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddWordContent(
    state: AddWordUiState,
    onBack: () -> Unit,
    onDelete: () -> Unit,
    onTextChange: (String) -> Unit,
    onLookUp: () -> Unit,
    onEdit: (ContentEdit) -> Unit,
    onAutoRefreshChange: (Boolean) -> Unit,
    onSave: () -> Unit,
    modifier: Modifier = Modifier,
    snackbarHost: SnackbarHostState = remember { SnackbarHostState() },
    wordFocus: FocusRequester = remember { FocusRequester() },
) {
    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = { Text(if (state.isEditing) "Edit word" else "Add word") },
                navigationIcon = { BackButton(onClick = onBack) },
                actions = {
                    if (state.isEditing) {
                        IconButton(onClick = onDelete) {
                            Icon(Icons.Default.Delete, contentDescription = "Delete word")
                        }
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbarHost) },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .consumeWindowInsets(padding)
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Spacer(Modifier.height(4.dp))

            OutlinedTextField(
                value = state.text,
                onValueChange = onTextChange,
                label = { Text("Word") },
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .focusRequester(wordFocus)
                    .testTag(TestTags.ADD_WORD_TEXT),
                keyboardOptions = KeyboardOptions(
                    capitalization = KeyboardCapitalization.None,
                    imeAction = ImeAction.Next,
                ),
            )

            LookupRow(
                enabled = state.canLookUp,
                loading = state.lookingUp,
                hasApiKey = state.hasApiKey,
                onLookUp = onLookUp,
            )

            // Every field stays editable whether or not Claude filled it: the app has to
            // be fully usable offline and with no API key at all.
            state.content.definitions.forEachIndexed { d, definition ->
                DefinitionEditor(d, definition, word = state.text.trim(), onEdit = onEdit)
            }
            TextButton(
                onClick = { onEdit(ContentEdit.AddDefinition) },
                modifier = Modifier.testTag(TestTags.ADD_WORD_ADD_DEFINITION),
            ) {
                Text("Add definition")
            }

            AutoRefreshToggle(
                checked = state.autoRefresh,
                hasApiKey = state.hasApiKey,
                onCheckedChange = onAutoRefreshChange,
            )

            Spacer(Modifier.height(4.dp))
            Button(
                onClick = onSave,
                enabled = state.canSave,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag(TestTags.ADD_WORD_SAVE),
            ) {
                Text(if (state.isEditing) "Save changes" else "Add word")
            }

            if (!state.isEditing && state.addedThisSession > 0) {
                Text(
                    text = "Added ${state.addedThisSession} this session · ${state.totalWords} total",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun DefinitionEditor(
    d: Int,
    definition: DefinitionDraft,
    word: String,
    onEdit: (ContentEdit) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text("Definition ${d + 1}", style = MaterialTheme.typography.titleMedium)
            if (d > 0) {
                IconButton(onClick = { onEdit(ContentEdit.RemoveDefinition(d)) }) {
                    Icon(Icons.Default.Delete, contentDescription = "Remove definition ${d + 1}")
                }
            }
        }

        OutlinedTextField(
            value = definition.text,
            onValueChange = { onEdit(ContentEdit.DefinitionText(d, it)) },
            label = { Text("Definition") },
            isError = definition.text.isBlank(),
            supportingText = {
                Text(if (definition.text.isBlank()) "Required" else "Shown as the prompt. Should not contain the word.")
            },
            minLines = 2,
            modifier = Modifier
                .fillMaxWidth()
                .testTag(if (d == 0) TestTags.ADD_WORD_DEFINITION else TestTags.addWordDefinition(d)),
        )

        OutlinedTextField(
            value = definition.partOfSpeech,
            onValueChange = { onEdit(ContentEdit.PartOfSpeech(d, it)) },
            label = { Text("Part of speech (optional)") },
            singleLine = true,
            modifier = Modifier
                .fillMaxWidth()
                .then(if (d == 0) Modifier.testTag(TestTags.ADD_WORD_PART_OF_SPEECH) else Modifier),
        )

        definition.forms.forEachIndexed { f, form ->
            FormEditor(d, f, form, word, onEdit)
        }
        TextButton(
            onClick = { onEdit(ContentEdit.AddForm(d)) },
            modifier = Modifier.testTag(TestTags.addWordAddForm(d)),
        ) {
            Text("Add form")
        }
    }
}

@Composable
private fun FormEditor(
    d: Int,
    f: Int,
    form: FormDraft,
    word: String,
    onEdit: (ContentEdit) -> Unit,
) {
    val isBase = d == 0 && f == 0
    val spelling = if (isBase) word else form.text.trim()
    Column(
        modifier = Modifier.padding(start = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (isBase) {
            Text(
                text = word.ifEmpty { "The word itself" },
                style = MaterialTheme.typography.titleSmall,
            )
        } else {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedTextField(
                    value = form.text,
                    onValueChange = { onEdit(ContentEdit.FormText(d, f, it)) },
                    label = { Text("Form") },
                    isError = form.text.isBlank(),
                    supportingText = if (form.text.isBlank()) ({ Text("Required") }) else null,
                    singleLine = true,
                    modifier = Modifier
                        .weight(1f)
                        .testTag(TestTags.addWordFormText(d, f)),
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.None),
                )
                IconButton(onClick = { onEdit(ContentEdit.RemoveForm(d, f)) }) {
                    val name = if (spelling.isEmpty()) "" else " “$spelling”"
                    Icon(Icons.Default.Delete, contentDescription = "Remove form$name")
                }
            }
        }

        OutlinedTextField(
            value = form.label,
            onValueChange = { onEdit(ContentEdit.FormLabel(d, f, it)) },
            label = { Text("Label (optional)") },
            singleLine = true,
            modifier = Modifier
                .fillMaxWidth()
                .testTag(TestTags.addWordFormLabel(d, f)),
        )

        form.examples.forEachIndexed { e, example ->
            val misses = spelling.isNotEmpty() && exampleMissesForm(example.text, spelling)
            OutlinedTextField(
                value = example.text,
                onValueChange = { onEdit(ContentEdit.ExampleText(d, f, e, it)) },
                label = { Text("Example sentence (optional)") },
                supportingText = {
                    Text(
                        if (misses) {
                            "Doesn't contain “$spelling”, so review can't blank it."
                        } else {
                            "The word is blanked out during review."
                        },
                        color = if (misses) MaterialTheme.colorScheme.error else Color.Unspecified,
                    )
                },
                trailingIcon = {
                    IconButton(onClick = { onEdit(ContentEdit.RemoveExample(d, f, e)) }) {
                        Icon(Icons.Default.Delete, contentDescription = "Remove example")
                    }
                },
                minLines = 2,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag(
                        if (d == 0 && f == 0 && e == 0) {
                            TestTags.ADD_WORD_EXAMPLE
                        } else {
                            TestTags.addWordExample(d, f, e)
                        },
                    ),
            )
        }
        TextButton(
            onClick = { onEdit(ContentEdit.AddExample(d, f)) },
            modifier = Modifier.testTag(TestTags.addWordAddExample(d, f)),
        ) {
            Text("Add example")
        }
    }
}

/**
 * Opts a word into getting a fresh example sentence from Claude.
 *
 * Off by default: it spends on the API every day the word is reviewed, which is not
 * something to switch on for someone. Worth it for a word that has climbed to a long
 * interval, where the same sentence has been read a dozen times and stopped teaching
 * anything.
 *
 * The whole row is the hit target rather than the checkbox alone, and it is labelled
 * as one control for screen readers, which is what `toggleable` with a null indication
 * on the Row plus a null onCheckedChange on the Checkbox buys.
 */
@Composable
private fun AutoRefreshToggle(
    checked: Boolean,
    hasApiKey: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .toggleable(value = checked, role = Role.Checkbox, onValueChange = onCheckedChange),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Checkbox(checked = checked, onCheckedChange = null)
        Column(Modifier.padding(vertical = 8.dp)) {
            Text("Keep this card fresh", style = MaterialTheme.typography.bodyLarge)
            Text(
                text = if (hasApiKey) {
                    "Claude adds a fresh example sentence once a day when this " +
                        "word comes up, ready for the time after."
                } else {
                    "Needs an API key in Settings. Claude would add a fresh example " +
                        "sentence once a day when this word comes up."
                },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun LookupRow(
    enabled: Boolean,
    loading: Boolean,
    hasApiKey: Boolean,
    onLookUp: () -> Unit,
) {
    Column {
        Row(
            verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            OutlinedButton(
                onClick = onLookUp,
                enabled = enabled,
                modifier = Modifier.testTag(TestTags.ADD_WORD_LOOK_UP),
            ) {
                if (loading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        strokeWidth = 2.dp,
                    )
                } else {
                    Icon(Icons.Default.AutoAwesome, contentDescription = null)
                }
                Spacer(Modifier.size(8.dp))
                Text(if (loading) "Looking up…" else "Look up with Claude")
            }
        }
        if (!hasApiKey) {
            Text(
                text = "Add an API key in Settings to use lookup, or write the fields yourself.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
