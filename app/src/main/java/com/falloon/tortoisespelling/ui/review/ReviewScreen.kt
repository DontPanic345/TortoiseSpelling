package com.falloon.tortoisespelling.ui.review

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
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
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.falloon.tortoisespelling.data.Word
import com.falloon.tortoisespelling.domain.BLANK_PLACEHOLDER
import com.falloon.tortoisespelling.domain.SpellingDiff
import com.falloon.tortoisespelling.ui.TestTags
import com.falloon.tortoisespelling.ui.rememberAppContainer
import com.falloon.tortoisespelling.ui.theme.BlankStyle
import com.falloon.tortoisespelling.ui.theme.LocalFeedbackColors
import com.falloon.tortoisespelling.ui.theme.WordStyle

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

    LaunchedEffect(state.finished, state.loading) {
        if (state.finished && !state.loading) {
            onFinished()
        }
    }

    // Re-focus for each word so the keyboard never has to be summoned by hand.
    LaunchedEffect(state.index, state.phase, state.loading) {
        if (!state.loading && state.phase !is ReviewPhase.Correct) {
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
            )
        },
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
            Prompt(word = word, phase = state.phase, blanked = state.blankedExample?.text)

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
            // most of the value of having an example at all.
            revealed && word.example.isNotBlank() ->
                Text(word.example, style = MaterialTheme.typography.bodyLarge)

            blanked != null ->
                Text(blanked, style = BlankStyle)

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

        ReviewPhase.Correct -> Box(
            Modifier
                .fillMaxWidth()
                .background(feedback.correctContainer, RoundedCornerShape(12.dp))
                .padding(16.dp),
        ) {
            Text("Correct: ${word.text}", color = feedback.correct, style = WordStyle)
        }

        is ReviewPhase.Corrective -> Column(
            Modifier
                .fillMaxWidth()
                .background(feedback.wrongContainer, RoundedCornerShape(12.dp))
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(
                "Not quite",
                style = MaterialTheme.typography.labelLarge,
                color = feedback.wrong,
            )
            DiffRow(label = "You typed", text = phase.attempt, diff = phase.diff, isAttempt = true)
            DiffRow(label = "Correct", text = word.text, diff = phase.diff, isAttempt = false)
            if (phase.retypeMissed) {
                Text(
                    "Not yet: type it exactly as shown above.",
                    style = MaterialTheme.typography.bodySmall,
                    color = feedback.wrong,
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
                                highlight.copy(alpha = 0.22f)
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
