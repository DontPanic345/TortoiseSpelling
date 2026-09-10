package com.falloon.spellwise.di

import android.content.Context
import com.falloon.spellwise.data.SettingsStore
import com.falloon.spellwise.data.SpellwiseDatabase
import com.falloon.spellwise.data.WordRepository
import com.falloon.spellwise.data.remote.ClaudeClient

/** Manual dependency graph. Hilt would be more machinery than this app needs. */
class AppContainer(context: Context) {

    private val database by lazy { SpellwiseDatabase.build(context) }

    val settings by lazy { SettingsStore(context) }

    val claude by lazy { ClaudeClient() }

    val repository by lazy { WordRepository(database.dao(), settings) }
}
