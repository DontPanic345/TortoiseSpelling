package io.github.dontpanic345.tortoisespelling.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import io.github.dontpanic345.tortoisespelling.domain.DayMark
import io.github.dontpanic345.tortoisespelling.domain.MarkedDay
import io.github.dontpanic345.tortoisespelling.domain.WordProgress
import io.github.dontpanic345.tortoisespelling.ui.RequestNotificationPermissionIfNeeded
import io.github.dontpanic345.tortoisespelling.ui.TestTags
import io.github.dontpanic345.tortoisespelling.ui.complete.CompletionPanel
import io.github.dontpanic345.tortoisespelling.ui.rememberAppContainer
import java.time.LocalDate
import java.time.format.TextStyle

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

    RequestNotificationPermissionIfNeeded(ready = !state.loading && state.hasWords)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Tortoise Spelling") },
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
                modifier = Modifier.testTag(TestTags.HOME_ADD_WORD),
                icon = { Icon(Icons.Default.Add, contentDescription = null) },
                text = { Text("Add word") },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp)
                // Clear of the floating action button, so the last card can scroll out
                // from under it.
                .padding(top = 8.dp, bottom = 96.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            when {
                state.loading -> Unit

                // No words at all is a different situation from having finished for the
                // day, and telling the user "all done" before they have added anything
                // would be nonsense.
                !state.hasWords -> FirstRunPanel(onAddWord = onAddWord)

                else -> {
                    Greeting(greeting = state.greeting, date = state.dateLabel)

                    if (state.allDone) {
                        Card(modifier = Modifier.fillMaxWidth(), colors = homeCardColors()) {
                            CompletionPanel(
                                reviewedCount = state.reviewedToday,
                                // The week card just below shows the streak; saying it
                                // twice on one screen is noise.
                                streak = 0,
                                nextDueDay = state.nextDueDay,
                                onPracticeMore = onPracticeMore,
                            )
                        }
                    } else {
                        TodayCard(
                            count = state.plan.total,
                            newCount = state.plan.newCount,
                            reviewedToday = state.reviewedToday,
                            onStart = onStartReview,
                        )
                    }

                    WeekCard(week = state.week, streak = state.streak)
                    WordsCard(progress = state.progress, onOpenWords = onOpenWords)
                }
            }
        }
    }
}

/** White on the parchment background in light theme, a step up from it in dark. */
@Composable
private fun homeCardColors() = CardDefaults.cardColors(
    containerColor = MaterialTheme.colorScheme.surfaceContainerLow,
)

@Composable
private fun Greeting(greeting: String, date: String) {
    Column(modifier = Modifier.padding(horizontal = 4.dp)) {
        Text(text = greeting, style = MaterialTheme.typography.headlineSmall)
        Text(
            text = date,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/** The tortoise, as decoration: TalkBack has nothing useful to say about it. */
@Composable
private fun Tortoise(size: Int) {
    Text(
        text = "🐢",
        fontSize = size.sp,
        modifier = Modifier.clearAndSetSemantics {},
    )
}

@Composable
private fun TodayCard(
    count: Int,
    newCount: Int,
    reviewedToday: Int,
    onStart: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer,
            contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
        ),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Tortoise(size = 48)
            Text(
                text = count.toString(),
                modifier = Modifier.testTag(TestTags.HOME_PRACTICE_COUNT),
                fontSize = 80.sp,
                style = MaterialTheme.typography.displayLarge,
                color = MaterialTheme.colorScheme.primary,
            )
            Text(
                text = if (count == 1) "word to practise today" else "words to practise today",
                style = MaterialTheme.typography.titleMedium,
                textAlign = TextAlign.Center,
            )

            if (newCount > 0) {
                Spacer(Modifier.height(4.dp))
                Text(
                    text = if (newCount == 1) "1 of them is new" else "$newCount of them are new",
                    style = MaterialTheme.typography.bodyMedium,
                )
            }

            Spacer(Modifier.height(24.dp))
            Button(
                onClick = onStart,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
            ) {
                Text("Start", style = MaterialTheme.typography.titleMedium)
            }

            if (reviewedToday > 0) {
                Spacer(Modifier.height(12.dp))
                Text(
                    text = "Reviewed today: $reviewedToday",
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
    }
}

@Composable
private fun WeekCard(week: List<MarkedDay>, streak: Int) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .testTag(TestTags.HOME_WEEK),
        colors = homeCardColors(),
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "This week",
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.weight(1f),
                )
                if (streak > 0) {
                    // Not the completion panel's "🔥 N day streak" wording: both can be on
                    // screen at once, and the e2e suite finds that line by its exact text.
                    Text(
                        text = if (streak == 1) "🔥 1 day in a row" else "🔥 $streak days in a row",
                        style = MaterialTheme.typography.labelLarge,
                    )
                }
            }
            Spacer(Modifier.height(16.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                week.forEach { DayDot(it, isToday = it == week.last()) }
            }
        }
    }
}

@Composable
private fun DayDot(day: MarkedDay, isToday: Boolean) {
    val locale = LocalConfiguration.current.locales[0]
    val weekday = LocalDate.ofEpochDay(day.day).dayOfWeek
    val letter = weekday.getDisplayName(TextStyle.NARROW, locale)
    val name = weekday.getDisplayName(TextStyle.FULL, locale)
    val description = when (day.mark) {
        DayMark.PRACTICED -> "practised"
        DayMark.NOTHING_DUE -> "nothing was due"
        DayMark.MISSED -> "missed"
        DayMark.PENDING -> "not practised yet"
        DayMark.BEFORE_START -> "before you started"
    }
    val colors = MaterialTheme.colorScheme

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.clearAndSetSemantics {
            contentDescription = if (isToday) "Today, $description" else "$name, $description"
        },
    ) {
        val circle = Modifier
            .size(34.dp)
            .clip(CircleShape)
        Box(
            contentAlignment = Alignment.Center,
            modifier = when (day.mark) {
                DayMark.PRACTICED -> circle.background(colors.primary)
                DayMark.NOTHING_DUE -> circle.background(colors.secondaryContainer)
                DayMark.MISSED -> circle.border(1.5.dp, colors.outlineVariant, CircleShape)
                DayMark.PENDING -> circle.border(2.dp, colors.primary, CircleShape)
                DayMark.BEFORE_START -> circle.background(colors.surfaceVariant.copy(alpha = 0.5f))
            },
        ) {
            when (day.mark) {
                DayMark.PRACTICED -> Icon(
                    imageVector = Icons.Default.Check,
                    contentDescription = null,
                    tint = colors.onPrimary,
                    modifier = Modifier.size(20.dp),
                )
                DayMark.NOTHING_DUE -> Box(
                    Modifier
                        .size(width = 12.dp, height = 2.dp)
                        .background(colors.onSecondaryContainer),
                )
                else -> Unit
            }
        }
        Spacer(Modifier.height(6.dp))
        Text(
            text = letter,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = if (isToday) FontWeight.Bold else FontWeight.Normal,
            color = if (isToday) colors.primary else colors.onSurfaceVariant,
        )
    }
}

@Composable
private fun WordsCard(progress: WordProgress, onOpenWords: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .testTag(TestTags.HOME_PROGRESS),
        colors = homeCardColors(),
    ) {
        Column(modifier = Modifier.padding(start = 20.dp, end = 8.dp, top = 8.dp, bottom = 20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "Your words",
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.weight(1f),
                )
                // Not "All words": that's the overflow menu item, which the e2e suite
                // finds by its text.
                TextButton(onClick = onOpenWords) { Text("See all") }
            }
            Column(modifier = Modifier.padding(end = 12.dp)) {
                ProgressBar(progress)
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    LegendEntry(colors.primary, "${progress.known} known")
                    LegendEntry(learningColor(), "${progress.learning} learning")
                    LegendEntry(colors.tertiary, "${progress.new} new")
                }
                Spacer(Modifier.height(12.dp))
                Text(
                    text = "A word is known once it goes three weeks between reviews.",
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.onSurfaceVariant,
                )
            }
        }
    }
}

/** Known, learning and new, as one bar split in proportion. */
@Composable
private fun ProgressBar(progress: WordProgress) {
    val colors = MaterialTheme.colorScheme
    val segments = listOf(
        progress.known to colors.primary,
        progress.learning to learningColor(),
        progress.new to colors.tertiary,
    ).filter { (count, _) -> count > 0 }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(12.dp)
            .clip(RoundedCornerShape(6.dp))
            .background(colors.surfaceVariant)
            .semantics {
                contentDescription =
                    "${progress.known} known, ${progress.learning} learning, ${progress.new} new"
            },
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        segments.forEach { (count, color) ->
            Box(
                Modifier
                    .weight(count.toFloat())
                    .height(12.dp)
                    .background(color),
            )
        }
    }
}

/**
 * Half-strength primary: on the way to known. The scheme's secondary is too close to
 * primary in the dark theme to tell the two segments apart.
 */
@Composable
private fun learningColor() = MaterialTheme.colorScheme.primary.copy(alpha = 0.45f)

@Composable
private fun LegendEntry(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier
                .size(10.dp)
                .clip(CircleShape)
                .background(color),
        )
        Spacer(Modifier.width(6.dp))
        Text(label, style = MaterialTheme.typography.labelLarge)
    }
}

@Composable
private fun FirstRunPanel(onAddWord: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Tortoise(size = 72)
        Spacer(Modifier.height(8.dp))
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

    Card(modifier = Modifier.fillMaxWidth(), colors = homeCardColors()) {
        Column(
            modifier = Modifier.padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("How it works", style = MaterialTheme.typography.titleMedium)
            HowItWorksStep("📝", "Add the words you keep getting wrong.")
            HowItWorksStep("✍️", "Spell each one from memory, from its definition and an example.")
            HowItWorksStep("🐢", "A few minutes a day. Each word comes back just before you'd forget it.")
        }
    }
}

@Composable
private fun HowItWorksStep(emoji: String, text: String) {
    Row(verticalAlignment = Alignment.Top) {
        Text(
            text = emoji,
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier
                .width(36.dp)
                .clearAndSetSemantics {},
        )
        Text(
            text = text,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
