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
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import io.github.dontpanic345.tortoisespelling.ui.BackButton
import io.github.dontpanic345.tortoisespelling.ui.TestTags
import io.github.dontpanic345.tortoisespelling.ui.rememberAppContainer

@OptIn(ExperimentalMaterial3Api::class)
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

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (state.isEditing) "Edit word" else "Add word") },
                navigationIcon = { BackButton(onClick = onDone) },
                actions = {
                    if (state.isEditing) {
                        IconButton(onClick = viewModel::delete) {
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
                onValueChange = viewModel::onTextChange,
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
                onLookUp = viewModel::lookUp,
            )

            // Every field stays editable whether or not Claude filled it: the app has to
            // be fully usable offline and with no API key at all.
            OutlinedTextField(
                value = state.definition,
                onValueChange = viewModel::onDefinitionChange,
                label = { Text("Definition") },
                supportingText = { Text("Shown as the prompt. Should not contain the word.") },
                minLines = 2,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag(TestTags.ADD_WORD_DEFINITION),
            )

            OutlinedTextField(
                value = state.example,
                onValueChange = viewModel::onExampleChange,
                label = { Text("Example sentence (optional)") },
                supportingText = { Text("The word is blanked out during review.") },
                minLines = 2,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag(TestTags.ADD_WORD_EXAMPLE),
            )

            OutlinedTextField(
                value = state.partOfSpeech,
                onValueChange = viewModel::onPartOfSpeechChange,
                label = { Text("Part of speech (optional)") },
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag(TestTags.ADD_WORD_PART_OF_SPEECH),
            )

            AutoRefreshToggle(
                checked = state.autoRefresh,
                hasApiKey = state.hasApiKey,
                onCheckedChange = viewModel::onAutoRefreshChange,
            )

            Spacer(Modifier.height(4.dp))
            Button(
                onClick = viewModel::save,
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

/**
 * Opts a word into having its card rewritten by Claude.
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
                    "Claude writes a new definition and example once a day when this " +
                        "word comes up, ready for the time after."
                } else {
                    "Needs an API key in Settings. Claude would write a new definition " +
                        "and example once a day when this word comes up."
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
