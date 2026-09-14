package com.falloon.tortoisespelling.ui.words

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.PauseCircle
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.falloon.tortoisespelling.data.Word
import com.falloon.tortoisespelling.domain.WordFilter
import com.falloon.tortoisespelling.ui.EmptyState
import com.falloon.tortoisespelling.ui.TestTags
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
                    .padding(horizontal = 16.dp, vertical = 8.dp)
                    .testTag(TestTags.WORD_LIST_SEARCH),
            )

            // With no words at all, six chips reading 0 would only crowd "No words yet".
            if ((state.filterCounts[WordFilter.ALL] ?: 0) > 0) {
                WordFilterRow(
                    selected = state.filter,
                    counts = state.filterCounts,
                    onSelect = viewModel::onFilterChange,
                )
            }

            when {
                state.loading -> Unit

                state.rows.isEmpty() && state.isFiltering -> EmptyState(
                    icon = Icons.AutoMirrored.Filled.MenuBook,
                    title = "No matches",
                    body = noMatchesBody(state.query, state.filter),
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

/** A single-select, horizontally scrolling row of filter chips, each showing its count. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun WordFilterRow(
    selected: WordFilter,
    counts: Map<WordFilter, Int>,
    onSelect: (WordFilter) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        WordFilter.entries.forEach { filter ->
            FilterChip(
                selected = filter == selected,
                onClick = { onSelect(filter) },
                label = { Text("${filter.label} ${counts[filter] ?: 0}") },
                modifier = Modifier.testTag(TestTags.wordFilter(filter.name.lowercase())),
            )
        }
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
            .testTag(TestTags.wordRow(row.word.normalizedText))
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
            StatusBadge(row)
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

/**
 * A row's scheduling status, as a small tonal badge rather than an `AssistChip` — a chip
 * looks tappable, and tapping it did nothing. Suspended gets a muted treatment since it
 * isn't a word making progress.
 */
@Composable
private fun StatusBadge(row: WordRow) {
    val colors = MaterialTheme.colorScheme
    val containerColor = if (row.word.suspended) colors.surfaceVariant else colors.secondaryContainer
    val contentColor = if (row.word.suspended) colors.onSurfaceVariant else colors.onSecondaryContainer
    Surface(
        color = containerColor,
        contentColor = contentColor,
        shape = RoundedCornerShape(6.dp),
    ) {
        Text(
            text = row.status,
            style = MaterialTheme.typography.labelSmall,
            modifier = Modifier
                .padding(horizontal = 8.dp, vertical = 3.dp)
                .testTag(TestTags.wordRowStatus(row.word.normalizedText)),
        )
    }
}
