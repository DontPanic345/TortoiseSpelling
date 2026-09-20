package io.github.dontpanic345.tortoisespelling.ui.review

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.InlineTextContent
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.appendInlineContent
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.Placeholder
import androidx.compose.ui.text.PlaceholderVerticalAlign
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import io.github.dontpanic345.tortoisespelling.data.Word
import io.github.dontpanic345.tortoisespelling.domain.BLANK_PLACEHOLDER
import io.github.dontpanic345.tortoisespelling.domain.SpellingDiff
import io.github.dontpanic345.tortoisespelling.ui.TestTags
import io.github.dontpanic345.tortoisespelling.ui.rememberAppContainer
import io.github.dontpanic345.tortoisespelling.ui.theme.BlankStyle
import io.github.dontpanic345.tortoisespelling.ui.theme.LocalFeedbackColors
import io.github.dontpanic345.tortoisespelling.ui.theme.WordStyle

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReviewScreen(
    practiceMode: Boolean,
    onFinished: () -> Unit,
    onQuit: () -> Unit,
) {
    val container = rememberAppContainer()
    val viewModel: ReviewViewModel = viewModel(
        key = if (practiceMode) "practice" else "review",
        factory = ReviewViewModel.factory(container, practiceMode),
    )
    val state by viewModel.state.collectAsStateWithLifecycle()
    val focusRequester = remember { FocusRequester() }
    val snackbarHost = remember { SnackbarHostState() }

    LaunchedEffect(state.finished, state.loading) {
        if (state.finished && !state.loading) {
            onFinished()
        }
    }

    LaunchedEffect(state.message) {
        state.message?.let { message ->
            snackbarHost.showSnackbar(message)
            viewModel.consumeMessage()
        }
    }

    // Re-focus for each word so the keyboard never has to be summoned by hand. A
    // finished refresh counts: tapping the toolbar took focus off the field, and the
    // user was in the middle of typing an answer.
    LaunchedEffect(state.index, state.phase, state.loading, state.refreshing) {
        if (!state.loading && !state.refreshing && state.phase !is ReviewPhase.Correct) {
            runCatching { focusRequester.requestFocus() }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        if (practiceMode) "Extra practice" else "${state.position} / ${state.total}",
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onQuit) {
                        Icon(Icons.Default.Close, contentDescription = "End session")
                    }
                },
                actions = {
                    // Hidden without a key rather than shown disabled: the app is meant
                    // to be fully usable with no Anthropic account at all.
                    if (state.canRefresh || state.refreshing) {
                        RefreshCardAction(
                            enabled = state.canRefresh,
                            refreshing = state.refreshing,
                            onRefresh = viewModel::refreshCard,
                        )
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbarHost) },
    ) { padding ->
        if (state.loading) {
            Box(
                Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator()
            }
            return@Scaffold
        }

        val word = state.current ?: return@Scaffold

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp),
        ) {
            if (state.total > 0) {
                LinearProgressIndicator(
                    progress = { state.index.toFloat() / state.total },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 4.dp),
                )
            }

            Spacer(Modifier.height(28.dp))
            Prompt(
                word = word,
                phase = state.phase,
                // Only a sentence the word was actually found in: an example that came
                // back with an inflection ("She ran the race" for "run") has nothing
                // blanked out in it, and showing it whole hands over most of the answer.
                blanked = state.blankedExample?.takeIf { it.didBlank }?.text,
            )

            Spacer(Modifier.height(28.dp))
            AnswerField(
                value = state.input,
                phase = state.phase,
                focusRequester = focusRequester,
                onValueChange = viewModel::onInputChange,
                onSubmit = viewModel::submit,
            )

            Spacer(Modifier.height(16.dp))
            Feedback(word = word, phase = state.phase)

            Spacer(Modifier.height(24.dp))
            Button(
                onClick = viewModel::submit,
                enabled = state.input.isNotBlank() || state.phase is ReviewPhase.Correct,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag(TestTags.REVIEW_SUBMIT),
            ) {
                Text(
                    when (state.phase) {
                        ReviewPhase.Correct -> "Continue"
                        is ReviewPhase.Corrective -> "Check retype"
                        ReviewPhase.Prompting -> "Check"
                    },
                )
            }
            Spacer(Modifier.height(32.dp))
        }
    }
}

/**
 * Asks Claude for a new definition and example for the word on screen.
 *
 * Same sparkle icon as "Look up with Claude" on the add screen, so the two read as the
 * one feature. It sits in the toolbar rather than under the prompt because it is a
 * rescue hatch for a card worn smooth by a dozen reviews, not part of answering.
 */
@Composable
private fun RefreshCardAction(enabled: Boolean, refreshing: Boolean, onRefresh: () -> Unit) {
    IconButton(onClick = onRefresh, enabled = enabled) {
        if (refreshing) {
            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
        } else {
            Icon(
                Icons.Default.AutoAwesome,
                contentDescription = "New definition and example",
            )
        }
    }
}

@Composable
private fun Prompt(word: Word, phase: ReviewPhase, blanked: String?) {
    Column {
        word.partOfSpeech?.let { partOfSpeech ->
            Text(
                text = partOfSpeech,
                style = MaterialTheme.typography.labelLarge,
                fontStyle = FontStyle.Italic,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(4.dp))
        }
        Text(text = word.definition, style = MaterialTheme.typography.headlineSmall)

        Spacer(Modifier.height(20.dp))

        val revealed = phase is ReviewPhase.Correct
        when {
            // Once answered, show the sentence intact: seeing the word in context is
            // most of the value of having an example at all. It stays in the body
            // face, same as the blanked sentence below, so nothing jumps.
            revealed && word.example.isNotBlank() ->
                Text(word.example, style = MaterialTheme.typography.bodyLarge)

            blanked != null -> BlankedExample(blanked)

            // No example, or one the word couldn't be blanked out of.
            else -> Column {
                Text(BLANK_PLACEHOLDER, style = BlankStyle)
                Text(
                    "type the word",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/** Tag identifying the blanked word within [BlankedExample]'s inline content map. */
private const val BLANK_INLINE_CONTENT_ID = "blank"

/**
 * Renders an example sentence in the normal body face, with [BLANK_PLACEHOLDER]
 * swapped for a fixed-width underline instead of literal underscores — underscores
 * in body text read as stray punctuation, not a blank to fill in.
 *
 * The underline is drawn by [InlineTextContent], a placeholder composable Compose
 * lays out inline with the text. Its width is fixed regardless of the hidden word's
 * length, so it can't give the answer away. [BLANK_PLACEHOLDER] is still passed as
 * the placeholder's alternate text, which is what ends up in the [AnnotatedString]'s
 * own text — and therefore in the accessibility tree — so screen readers and the e2e
 * suite still see "_____" even though the underline, not underscores, is painted.
 */
@Composable
private fun BlankedExample(sentence: String) {
    val underlineColor = MaterialTheme.colorScheme.onSurface
    val inlineContent = remember(underlineColor) {
        mapOf(
            BLANK_INLINE_CONTENT_ID to InlineTextContent(
                Placeholder(
                    width = 3.5.em,
                    height = 0.15.em,
                    placeholderVerticalAlign = PlaceholderVerticalAlign.AboveBaseline,
                ),
            ) {
                Box(Modifier.fillMaxSize().background(underlineColor))
            },
        )
    }

    val annotated = buildAnnotatedString {
        var remaining = sentence
        while (true) {
            val blankAt = remaining.indexOf(BLANK_PLACEHOLDER)
            if (blankAt < 0) {
                append(remaining)
                break
            }
            append(remaining.substring(0, blankAt))
            appendInlineContent(BLANK_INLINE_CONTENT_ID, alternateText = BLANK_PLACEHOLDER)
            remaining = remaining.substring(blankAt + BLANK_PLACEHOLDER.length)
        }
    }

    Text(
        text = annotated,
        style = MaterialTheme.typography.bodyLarge,
        inlineContent = inlineContent,
    )
}

@Composable
private fun AnswerField(
    value: String,
    phase: ReviewPhase,
    focusRequester: FocusRequester,
    onValueChange: (String) -> Unit,
    onSubmit: () -> Unit,
) {
    val feedback = LocalFeedbackColors.current
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = Modifier
            .fillMaxWidth()
            .focusRequester(focusRequester)
            .testTag(TestTags.REVIEW_ANSWER),
        readOnly = phase is ReviewPhase.Correct,
        singleLine = true,
        textStyle = WordStyle,
        label = {
            Text(
                when (phase) {
                    is ReviewPhase.Corrective -> "Type the correct spelling"
                    else -> "Your answer"
                },
            )
        },
        isError = phase is ReviewPhase.Corrective,
        // The single most important configuration in the app: if the keyboard
        // autocorrects a misspelling into the right word — or just offers it in the
        // suggestion strip — the exercise is worthless. autoCorrectEnabled +
        // KeyboardType.Ascii are widely ignored by Gboard and Samsung Keyboard, so
        // we use Password type (TYPE_TEXT_VARIATION_VISIBLE_PASSWORD), the one flag
        // both honour: no suggestion strip, no autocorrect, and the word is never
        // learned into the personal dictionary. The text stays readable because the
        // field keeps the default VisualTransformation.None (Compose does not mask
        // on keyboard type alone), so the miss diff still works.
        keyboardOptions = KeyboardOptions(
            autoCorrectEnabled = false,
            capitalization = KeyboardCapitalization.None,
            keyboardType = KeyboardType.Password,
            imeAction = ImeAction.Done,
        ),
        keyboardActions = KeyboardActions(onDone = { onSubmit() }),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = when (phase) {
                ReviewPhase.Correct -> feedback.correct
                is ReviewPhase.Corrective -> feedback.wrong
                ReviewPhase.Prompting -> MaterialTheme.colorScheme.primary
            },
        ),
    )
}

@Composable
private fun Feedback(word: Word, phase: ReviewPhase) {
    val feedback = LocalFeedbackColors.current
    when (phase) {
        ReviewPhase.Prompting -> Unit

        // A small caption above the word, matching DiffRow's label below — not
        // "Correct: word" in WordStyle, which ran two lines for a long word.
        ReviewPhase.Correct -> Column(
            Modifier
                .fillMaxWidth()
                .background(feedback.correctContainer, RoundedCornerShape(12.dp))
                .padding(16.dp),
        ) {
            Text(
                "Correct",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                word.text,
                color = feedback.correct,
                style = WordStyle,
                modifier = Modifier.testTag(TestTags.REVIEW_CORRECT_WORD),
            )
        }

        // Every row gets the same 8dp inset as the correctContainer one, so the two
        // spellings line up letter for letter.
        is ReviewPhase.Corrective -> Column(
            Modifier
                .fillMaxWidth()
                .padding(8.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(
                "Not quite",
                style = MaterialTheme.typography.labelLarge,
                color = feedback.wrong,
                modifier = Modifier.padding(horizontal = 8.dp),
            )
            Column(Modifier.padding(horizontal = 8.dp)) {
                DiffRow(label = "You typed", text = phase.attempt, diff = phase.diff, isAttempt = true)
            }
            Column(
                Modifier
                    .fillMaxWidth()
                    .background(feedback.correctContainer, RoundedCornerShape(8.dp))
                    .padding(8.dp),
            ) {
                DiffRow(label = "Correct", text = word.text, diff = phase.diff, isAttempt = false)
            }
            if (phase.retypeMissed) {
                Text(
                    "Not yet: type it exactly as shown above.",
                    style = MaterialTheme.typography.bodySmall,
                    color = feedback.wrong,
                    modifier = Modifier.padding(horizontal = 8.dp),
                )
            }
        }
    }
}

/**
 * Renders one side of the comparison, dimming what matched and marking the character
 * where the two words parted company.
 */
@Composable
private fun DiffRow(label: String, text: String, diff: SpellingDiff, isAttempt: Boolean) {
    val feedback = LocalFeedbackColors.current
    val highlight = if (isAttempt) feedback.wrong else feedback.correct
    val muted = MaterialTheme.colorScheme.onSurfaceVariant

    Column {
        Text(label, style = MaterialTheme.typography.labelSmall, color = muted)
        Text(
            text = buildAnnotatedString {
                text.forEachIndexed { index, character ->
                    val diverged = diff.firstDivergence >= 0 && index >= diff.firstDivergence
                    withStyle(
                        SpanStyle(
                            color = if (diverged) highlight else muted,
                            background = if (index == diff.firstDivergence) {
                                // The Correct row sits on correctContainer, which needs
                                // more than the 0.22 alpha that is legible on a plain
                                // background.
                                highlight.copy(alpha = 0.35f)
                            } else {
                                Color.Transparent
                            },
                        ),
                    ) {
                        append(character)
                    }
                }
            },
            style = WordStyle,
        )
    }
}
