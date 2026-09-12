package com.falloon.tortoisespelling.ui.words

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.PauseCircle
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.falloon.tortoisespelling.data.Word
import com.falloon.tortoisespelling.ui.EmptyState
import com.falloon.tortoisespelling.ui.rememberAppContainer

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WordListScreen(
    onBack: () -> Unit,
    onEdit: (Long) -> Unit,
) {
    val container = rememberAppContainer()
    val viewModel: WordListViewModel = viewModel(factory = WordListViewModel.factory(container))
    val state by viewModel.state.collectAsStateWithLifecycle()
    var pendingDelete by remember { mutableStateOf<Word?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("All words (${state.totalCount})") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            OutlinedTextField(
                value = state.query,
                onValueChange = viewModel::onQueryChange,
                label = { Text("Search") },
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
            )

            when {
                state.loading -> Unit

                state.rows.isEmpty() && state.isFiltering -> EmptyState(
                    icon = Icons.AutoMirrored.Filled.MenuBook,
                    title = "No matches",
                    body = "Nothing in your list matches “${state.query}”.",
                )

                state.rows.isEmpty() -> EmptyState(
                    icon = Icons.AutoMirrored.Filled.MenuBook,
                    title = "No words yet",
                    body = "Words you add will show up here with their next review date.",
                )

                else -> LazyColumn(Modifier.fillMaxSize()) {
                    items(state.rows, key = { it.word.id }) { row ->
                        WordListItem(
                            row = row,
                            onClick = { onEdit(row.word.id) },
                            onToggleSuspended = { viewModel.toggleSuspended(row.word) },
                            onDelete = { pendingDelete = row.word },
                        )
                        HorizontalDivider()
                    }
                }
            }
        }
    }

    pendingDelete?.let { word ->
        AlertDialog(
            onDismissRequest = { pendingDelete = null },
            title = { Text("Delete “${word.text}”?") },
            text = { Text("Its review history goes too. This can't be undone.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.delete(word)
                        pendingDelete = null
                    },
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { pendingDelete = null }) { Text("Cancel") }
            },
        )
    }
}

@Composable
private fun WordListItem(
    row: WordRow,
    onClick: () -> Unit,
    onToggleSuspended: () -> Unit,
    onDelete: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(start = 16.dp, top = 10.dp, bottom = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(row.word.text, style = MaterialTheme.typography.titleMedium)
            Text(
                text = row.word.definition,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            AssistChip(
                onClick = onClick,
                label = { Text(row.status, style = MaterialTheme.typography.labelSmall) },
                colors = AssistChipDefaults.assistChipColors(),
            )
        }
        IconButton(onClick = onToggleSuspended) {
            Icon(
                imageVector = if (row.word.suspended) {
                    Icons.Default.PlayCircle
                } else {
                    Icons.Default.PauseCircle
                },
                contentDescription = if (row.word.suspended) "Resume word" else "Suspend word",
            )
        }
        IconButton(onClick = onDelete) {
            Icon(Icons.Default.Delete, contentDescription = "Delete word")
        }
    }
}
