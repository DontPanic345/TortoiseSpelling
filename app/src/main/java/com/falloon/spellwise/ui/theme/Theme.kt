package com.falloon.spellwise.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ProvidableCompositionLocal
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/**
 * Answer feedback colours, kept off the Material scheme because "you spelled it
 * right" is not one of its roles and must stay legible in both themes.
 */
data class FeedbackColors(
    val correct: Color,
    val correctContainer: Color,
    val wrong: Color,
    val wrongContainer: Color,
)

val LocalFeedbackColors: ProvidableCompositionLocal<FeedbackColors> =
    staticCompositionLocalOf {
        FeedbackColors(CorrectGreen, CorrectGreenContainer, WrongRed, WrongRedContainer)
    }

private val LightScheme = lightColorScheme(
    primary = Evergreen,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFCFE5DC),
    onPrimaryContainer = EvergreenDark,
    secondary = EvergreenLight,
    background = Parchment,
    onBackground = Ink,
    surface = Color.White,
    onSurface = Ink,
    surfaceVariant = Color(0xFFE6E3DC),
    onSurfaceVariant = Color(0xFF4A4A46),
    error = WrongRed,
)

private val DarkScheme = darkColorScheme(
    primary = Color(0xFF9CCFBE),
    onPrimary = Color(0xFF073428),
    primaryContainer = Color(0xFF25503F),
    onPrimaryContainer = Color(0xFFB9EBD9),
    secondary = Color(0xFFB1CCC1),
    background = Color(0xFF141615),
    onBackground = Color(0xFFE3E3DF),
    surface = Color(0xFF1C1F1E),
    onSurface = Color(0xFFE3E3DF),
    surfaceVariant = Color(0xFF3F4945),
    onSurfaceVariant = Color(0xFFBFC9C4),
    error = WrongRedDark,
)

@Composable
fun SpellwiseTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val feedback = if (darkTheme) {
        FeedbackColors(
            CorrectGreenDark,
            CorrectGreenContainerDark,
            WrongRedDark,
            WrongRedContainerDark,
        )
    } else {
        FeedbackColors(CorrectGreen, CorrectGreenContainer, WrongRed, WrongRedContainer)
    }

    CompositionLocalProvider(LocalFeedbackColors provides feedback) {
        MaterialTheme(
            colorScheme = if (darkTheme) DarkScheme else LightScheme,
            typography = SpellwiseTypography,
            content = content,
        )
    }
}
