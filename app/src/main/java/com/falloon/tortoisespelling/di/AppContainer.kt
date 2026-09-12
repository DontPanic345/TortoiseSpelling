package com.falloon.tortoisespelling.di

import android.content.Context
import com.falloon.tortoisespelling.data.SettingsStore
import com.falloon.tortoisespelling.data.TortoiseSpellingDatabase
import com.falloon.tortoisespelling.data.WordRepository
import com.falloon.tortoisespelling.data.remote.ClaudeClient

/** Manual dependency graph. Hilt would be more machinery than this app needs. */
class AppContainer(context: Context) {

    private val database by lazy { TortoiseSpellingDatabase.build(context) }

    val settings by lazy { SettingsStore(context) }

    val claude by lazy { ClaudeClient() }

    val repository by lazy { WordRepository(database.dao(), settings) }
}
