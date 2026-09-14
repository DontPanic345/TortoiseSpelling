package io.github.dontpanic345.tortoisespelling.di

import android.content.Context
import io.github.dontpanic345.tortoisespelling.data.SettingsStore
import io.github.dontpanic345.tortoisespelling.data.TortoiseSpellingDatabase
import io.github.dontpanic345.tortoisespelling.data.WordRepository
import io.github.dontpanic345.tortoisespelling.data.remote.ClaudeClient

/** Manual dependency graph. Hilt would be more machinery than this app needs. */
class AppContainer(context: Context) {

    private val database by lazy { TortoiseSpellingDatabase.build(context) }

    val settings by lazy { SettingsStore(context) }

    val claude by lazy { ClaudeClient() }

    val repository by lazy { WordRepository(database.dao(), settings) }
}
