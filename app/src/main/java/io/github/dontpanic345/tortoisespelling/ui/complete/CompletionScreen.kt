package io.github.dontpanic345.tortoisespelling.ui.complete

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import io.github.dontpanic345.tortoisespelling.ui.home.HomeViewModel
import io.github.dontpanic345.tortoisespelling.ui.rememberAppContainer

/**
 * Shown when a session runs out of words. Reuses [HomeViewModel] because the numbers
 * are exactly the ones home shows; there is no second source of truth to drift.
 */
@Composable
fun CompletionScreen(
    onDone: () -> Unit,
    onPracticeMore: () -> Unit,
) {
    val container = rememberAppContainer()
    val viewModel: HomeViewModel = viewModel(
        key = "completion",
        factory = HomeViewModel.factory(container),
    )
    val state by viewModel.state.collectAsStateWithLifecycle()

    Scaffold { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                CompletionPanel(
                    reviewedCount = state.reviewedToday,
                    streak = state.streak,
                    nextDueDay = state.nextDueDay,
                    onPracticeMore = onPracticeMore,
                )
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = onDone,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 40.dp),
                ) {
                    Text("Done")
                }
            }
        }
    }
}
