package io.github.dontpanic345.tortoisespelling.ui.theme

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
)

val LocalFeedbackColors: ProvidableCompositionLocal<FeedbackColors> =
    staticCompositionLocalOf {
        FeedbackColors(CorrectGreen, CorrectGreenContainer, WrongRed)
    }

// Every role Material 3 components read is set here. A role left out falls back to
// Material's purple baseline, which is how menus, dialogs and the review progress track
// used to come out lavender.
//
// surface matches background, so top app bars sit flush with the page instead of as a
// white band across it. Cards and menus step off it through the surfaceContainer roles.
private val LightScheme = lightColorScheme(
    primary = Evergreen,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFCFE5DC),
    onPrimaryContainer = EvergreenDark,
    secondary = EvergreenLight,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFDCE8E2),
    onSecondaryContainer = EvergreenDark,
    tertiary = ShellAmber,
    onTertiary = Color.White,
    tertiaryContainer = Color(0xFFF6E3C7),
    onTertiaryContainer = Color(0xFF3B2503),
    background = Parchment,
    onBackground = Ink,
    surface = Parchment,
    onSurface = Ink,
    surfaceVariant = Color(0xFFE6E3DC),
    onSurfaceVariant = Color(0xFF4A4A46),
    surfaceContainerLowest = Color.White,
    surfaceContainerLow = Color.White,
    surfaceContainer = Color(0xFFF1EDE6),
    surfaceContainerHigh = Color(0xFFECE8E0),
    surfaceContainerHighest = Color(0xFFE6E3DC),
    outline = Color(0xFF7A776F),
    outlineVariant = Color(0xFFD6D1C7),
    error = WrongRed,
)

private val DarkScheme = darkColorScheme(
    primary = Color(0xFF9CCFBE),
    onPrimary = Color(0xFF073428),
    primaryContainer = Color(0xFF25503F),
    onPrimaryContainer = Color(0xFFB9EBD9),
    secondary = Color(0xFFB1CCC1),
    onSecondary = Color(0xFF1D352D),
    secondaryContainer = Color(0xFF2C3F38),
    onSecondaryContainer = Color(0xFFCFE5DC),
    tertiary = ShellAmberDark,
    onTertiary = Color(0xFF442B00),
    tertiaryContainer = Color(0xFF5C3F17),
    onTertiaryContainer = Color(0xFFFFDDB3),
    background = Color(0xFF141615),
    onBackground = Color(0xFFE3E3DF),
    surface = Color(0xFF141615),
    onSurface = Color(0xFFE3E3DF),
    surfaceVariant = Color(0xFF3F4945),
    onSurfaceVariant = Color(0xFFBFC9C4),
    surfaceContainerLowest = Color(0xFF0F1110),
    surfaceContainerLow = Color(0xFF1C1F1E),
    surfaceContainer = Color(0xFF202322),
    surfaceContainerHigh = Color(0xFF2A2D2C),
    surfaceContainerHighest = Color(0xFF353837),
    outline = Color(0xFF89938E),
    outlineVariant = Color(0xFF3F4945),
    error = WrongRedDark,
)

@Composable
fun TortoiseSpellingTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val feedback = if (darkTheme) {
        FeedbackColors(
            CorrectGreenDark,
            CorrectGreenContainerDark,
            WrongRedDark,
        )
    } else {
        FeedbackColors(CorrectGreen, CorrectGreenContainer, WrongRed)
    }

    CompositionLocalProvider(LocalFeedbackColors provides feedback) {
        MaterialTheme(
            colorScheme = if (darkTheme) DarkScheme else LightScheme,
            typography = TortoiseSpellingTypography,
            content = content,
        )
    }
}
