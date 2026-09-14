package io.github.dontpanic345.tortoisespelling.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import io.github.dontpanic345.tortoisespelling.TortoiseSpellingApp
import io.github.dontpanic345.tortoisespelling.di.AppContainer

object Routes {
    const val HOME = "home"
    const val REVIEW = "review"
    const val PRACTICE = "practice"
    const val COMPLETION = "completion"
    const val ADD = "add"
    const val WORDS = "words"
    const val SETTINGS = "settings"

    const val EDIT_ARG = "wordId"
    const val EDIT = "edit/{$EDIT_ARG}"

    fun edit(wordId: Long) = "edit/$wordId"
}

@Composable
fun rememberAppContainer(): AppContainer =
    (LocalContext.current.applicationContext as TortoiseSpellingApp).container
