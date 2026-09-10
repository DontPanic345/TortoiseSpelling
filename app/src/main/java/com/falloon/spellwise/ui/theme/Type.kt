package com.falloon.spellwise.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

val SpellwiseTypography = Typography()

/**
 * Words under test are shown monospaced so every character occupies the same width.
 * Letter-by-letter comparison is the entire task; proportional text hides a doubled
 * letter or a transposition that monospace makes obvious.
 */
val WordStyle = TextStyle(
    fontFamily = FontFamily.Monospace,
    fontSize = 30.sp,
    fontWeight = FontWeight.Medium,
    letterSpacing = 2.sp,
)

val BlankStyle = TextStyle(
    fontFamily = FontFamily.Monospace,
    fontSize = 22.sp,
    letterSpacing = 1.sp,
)
