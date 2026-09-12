package com.falloon.tortoisespelling.ui.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.falloon.tortoisespelling.ui.complete.CompletionPanel
import com.falloon.tortoisespelling.ui.rememberAppContainer

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onStartReview: () -> Unit,
    onPracticeMore: () -> Unit,
    onAddWord: () -> Unit,
    onOpenWords: () -> Unit,
    onOpenSettings: () -> Unit,
) {
    val container = rememberAppContainer()
    val viewModel: HomeViewModel = viewModel(factory = HomeViewModel.factory(container))
    val state by viewModel.state.collectAsStateWithLifecycle()
    var menuOpen by remember { mutableStateOf(false) }

    // Counts move with the clock and with sessions finished elsewhere in the graph, so
    // they have to be re-read on resume rather than only when the screen is created.
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { viewModel.refresh() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("TortoiseSpelling") },
                actions = {
                    IconButton(onClick = { menuOpen = true }) {
                        Icon(Icons.Default.MoreVert, contentDescription = "More")
                    }
                    DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                        DropdownMenuItem(
                            text = { Text("Add word") },
                            onClick = { menuOpen = false; onAddWord() },
                        )
                        DropdownMenuItem(
                            text = { Text("All words") },
                            onClick = { menuOpen = false; onOpenWords() },
                        )
                        DropdownMenuItem(
                            text = { Text("Settings") },
                            onClick = { menuOpen = false; onOpenSettings() },
                        )
                    }
                },
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = onAddWord,
                icon = { Icon(Icons.Default.Add, contentDescription = null) },
                text = { Text("Add word") },
            )
        },
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentAlignment = Alignment.Center,
        ) {
            when {
                state.loading -> Unit

                // No words at all is a different situation from having finished for the
                // day, and telling the user "all done" before they have added anything
                // would be nonsense.
                !state.hasWords -> FirstRunPanel(onAddWord = onAddWord)

                state.allDone -> CompletionPanel(
                    reviewedCount = state.reviewedToday,
                    streak = state.streak,
                    nextReviewLabel = viewModel.nextReviewLabel(),
                    onPracticeMore = onPracticeMore,
                )

                else -> TodayPanel(
                    count = state.plan.total,
                    newCount = state.plan.newCount,
                    streak = state.streak,
                    reviewedToday = state.reviewedToday,
                    onStart = onStartReview,
                )
            }
        }
    }
}

@Composable
private fun TodayPanel(
    count: Int,
    newCount: Int,
    streak: Int,
    reviewedToday: Int,
    onStart: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = count.toString(),
            fontSize = 92.sp,
            style = MaterialTheme.typography.displayLarge,
            color = MaterialTheme.colorScheme.primary,
        )
        Text(
            text = if (count == 1) "word to practice today" else "words to practice today",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )

        if (newCount > 0) {
            Spacer(Modifier.height(6.dp))
            Text(
                text = if (newCount == 1) "1 of them is new" else "$newCount of them are new",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        Spacer(Modifier.height(32.dp))
        Button(
            onClick = onStart,
            modifier = Modifier.fillMaxWidth(),
            contentPadding = ButtonDefaults.ContentPadding,
        ) {
            Text("Start", style = MaterialTheme.typography.titleMedium)
        }

        Spacer(Modifier.height(24.dp))
        if (streak > 0) {
            Text(
                text = if (streak == 1) "🔥 1 day streak" else "🔥 $streak day streak",
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        if (reviewedToday > 0) {
            Text(
                text = "Reviewed today: $reviewedToday",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun FirstRunPanel(onAddWord: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(
            text = "No words yet",
            style = MaterialTheme.typography.headlineSmall,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = "Add a word you keep misspelling. Claude can write the definition and " +
                "an example sentence for you, or you can type them yourself.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(24.dp))
        Button(onClick = onAddWord) {
            Text("Add your first word")
        }
    }
}
