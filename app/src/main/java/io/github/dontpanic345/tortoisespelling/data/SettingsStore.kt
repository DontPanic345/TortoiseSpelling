package io.github.dontpanic345.tortoisespelling.data

import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.edit
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.security.KeyStore

data class Settings(
    val newWordsPerDay: Int = 10,
    val reminderEnabled: Boolean = true,
    val reminderHour: Int = 8,
    val reminderMinute: Int = 0,
    val cloudBackupEnabled: Boolean = false,
)

/** Preferences, stored plainly: none of them is a secret. */
class SettingsStore(context: Context, fileName: String = FILE) {

    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences(fileName, Context.MODE_PRIVATE)

    init {
        forgetLegacyApiKey()
    }

    private val _settings = MutableStateFlow(read())
    val settings: StateFlow<Settings> = _settings.asStateFlow()

    fun current(): Settings = _settings.value

    private fun read() = Settings(
        newWordsPerDay = prefs.getInt(KEY_NEW_PER_DAY, 10),
        reminderEnabled = prefs.getBoolean(KEY_REMINDER_ON, true),
        reminderHour = prefs.getInt(KEY_REMINDER_HOUR, 8),
        reminderMinute = prefs.getInt(KEY_REMINDER_MINUTE, 0),
        cloudBackupEnabled = prefs.getBoolean(KEY_CLOUD_BACKUP_ENABLED, false),
    )

    private fun update(block: SharedPreferences.Editor.() -> Unit) {
        prefs.edit(action = block)
        _settings.value = read()
    }

    fun setNewWordsPerDay(value: Int) = update { putInt(KEY_NEW_PER_DAY, value.coerceIn(1, 100)) }

    fun setReminderEnabled(value: Boolean) = update { putBoolean(KEY_REMINDER_ON, value) }

    fun setReminderTime(hour: Int, minute: Int) = update {
        putInt(KEY_REMINDER_HOUR, hour.coerceIn(0, 23))
        putInt(KEY_REMINDER_MINUTE, minute.coerceIn(0, 59))
    }

    fun setCloudBackupEnabled(value: Boolean) = update { putBoolean(KEY_CLOUD_BACKUP_ENABLED, value) }

    /** Earlier versions stored an encrypted Anthropic API key. Remove it and its Keystore key. */
    private fun forgetLegacyApiKey() {
        if (!prefs.contains(LEGACY_KEY_API)) return
        prefs.edit { remove(LEGACY_KEY_API) }
        runCatching {
            KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.deleteEntry(LEGACY_KEYSTORE_ALIAS)
        }
    }

    // --- streak bookkeeping ---

    /**
     * Days on which nothing was due. These bridge a streak instead of breaking it: the
     * app told the user there was nothing to do, so it must not punish them for
     * believing it. Recorded by the reminder worker as well as the home screen, so a
     * quiet day still counts even if the app is never opened.
     */
    fun satisfiedDays(): Set<Long> =
        prefs.getStringSet(KEY_SATISFIED_DAYS, emptySet())
            .orEmpty()
            .mapNotNull(String::toLongOrNull)
            .toSet()

    fun markSatisfied(day: Long) {
        // Rolling window; an unbounded set would grow forever for no benefit.
        val kept = (satisfiedDays() + day).filter { it > day - SATISFIED_WINDOW_DAYS }
        prefs.edit {
            putStringSet(KEY_SATISFIED_DAYS, kept.map(Long::toString).toSet())
        }
    }

    // Internal, not private: TortoiseSpellingBackupAgent reads KEY_CLOUD_BACKUP_ENABLED
    // straight out of this same SharedPreferences file during a backup pass, when the
    // process is restricted and this class cannot be reached through AppContainer.
    internal companion object {
        const val FILE = "tortoisespelling-settings"
        const val KEY_NEW_PER_DAY = "newWordsPerDay"
        const val KEY_REMINDER_ON = "reminderEnabled"
        const val KEY_REMINDER_HOUR = "reminderHour"
        const val KEY_REMINDER_MINUTE = "reminderMinute"
        const val KEY_SATISFIED_DAYS = "satisfiedDays"
        const val KEY_CLOUD_BACKUP_ENABLED = "cloudBackupEnabled"
        const val SATISFIED_WINDOW_DAYS = 400L
        const val LEGACY_KEY_API = "apiKey"
        const val LEGACY_KEYSTORE_ALIAS = "tortoisespelling.settings.v1"
    }
}
