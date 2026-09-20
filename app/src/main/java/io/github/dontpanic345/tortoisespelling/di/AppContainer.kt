package io.github.dontpanic345.tortoisespelling.di

import android.content.Context
import io.github.dontpanic345.tortoisespelling.data.CardRefresher
import io.github.dontpanic345.tortoisespelling.data.SettingsStore
import io.github.dontpanic345.tortoisespelling.data.TortoiseSpellingDatabase
import io.github.dontpanic345.tortoisespelling.data.WordRepository
import io.github.dontpanic345.tortoisespelling.data.remote.ClaudeClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

/** Manual dependency graph. Hilt would be more machinery than this app needs. */
class AppContainer(context: Context) {

    private val database by lazy { TortoiseSpellingDatabase.build(context) }

    /**
     * Lives as long as the process, for work that must outlast the screen that asked
     * for it — currently only the card refresh, which a user quitting the review
     * session halfway through should not cancel. SupervisorJob so one failed word
     * doesn't take the rest of the app's background work down with it.
     */
    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    val settings by lazy { SettingsStore(context) }

    val claude by lazy { ClaudeClient() }

    val repository by lazy { WordRepository(database.dao(), settings) }

    val cardRefresher by lazy { CardRefresher(repository, settings, claude, appScope) }
}
