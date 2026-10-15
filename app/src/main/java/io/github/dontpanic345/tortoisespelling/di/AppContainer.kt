package io.github.dontpanic345.tortoisespelling.di

import android.content.Context
import io.github.dontpanic345.tortoisespelling.data.SettingsStore
import io.github.dontpanic345.tortoisespelling.data.TortoiseSpellingDatabase
import io.github.dontpanic345.tortoisespelling.data.WordRepository
import io.github.dontpanic345.tortoisespelling.domain.DeviceClock
import io.github.dontpanic345.tortoisespelling.domain.fuzzedDueDay
import java.time.Clock

/** Manual dependency graph. Hilt would be more machinery than this app needs. */
class AppContainer(
    context: Context,
    val clock: Clock = DeviceClock,
    fuzz: (today: Long, intervalDays: Int) -> Long = ::fuzzedDueDay,
    openDatabase: () -> TortoiseSpellingDatabase = { TortoiseSpellingDatabase.build(context) },
    settingsFile: String = SettingsStore.FILE,
) {

    private val database by lazy(openDatabase)

    val settings by lazy { SettingsStore(context, settingsFile) }

    val repository by lazy { WordRepository(database.dao(), settings, clock, fuzz) }
}
