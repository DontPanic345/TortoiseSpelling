package io.github.dontpanic345.tortoisespelling.ui.complete

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

/**
 * The "you are finished" state.
 *
 * Shared between the end of a session and the home screen, because they are the same
 * message and it must not be possible to reach one and miss the other. This is the
 * screen the whole app exists to show: a clear, unambiguous stopping point.
 */
@Composable
fun CompletionPanel(
    reviewedCount: Int,
    streak: Int,
    nextReviewLabel: String,
    onPracticeMore: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("🎉", style = MaterialTheme.typography.displaySmall)
        Spacer(Modifier.height(12.dp))
        Text(
            text = "All done — see you tomorrow",
            style = MaterialTheme.typography.headlineSmall,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(12.dp))

        if (reviewedCount > 0) {
            Text(
                text = if (reviewedCount == 1) {
                    "You practiced 1 word today."
                } else {
                    "You practiced $reviewedCount words today."
                },
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        } else {
            Text(
                text = "Nothing was due today.",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        if (streak > 0) {
            Spacer(Modifier.height(4.dp))
            Text(
                text = if (streak == 1) "🔥 1 day streak" else "🔥 $streak day streak",
                style = MaterialTheme.typography.bodyLarge,
            )
        }

        Spacer(Modifier.height(4.dp))
        Text(
            text = "Next review: $nextReviewLabel",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        if (onPracticeMore != null) {
            Spacer(Modifier.height(24.dp))
            // Deliberately small and quiet. Offering extra practice is useful, but making
            // it prominent would undercut the "you are done" message this screen exists
            // to deliver.
            TextButton(onClick = onPracticeMore) {
                Text(
                    text = "Practice a few more anyway",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
