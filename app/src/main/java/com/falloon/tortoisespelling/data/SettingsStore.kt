package com.falloon.tortoisespelling.data

import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.edit
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class Settings(
    val apiKey: String = "",
    val newWordsPerDay: Int = 10,
    val reminderEnabled: Boolean = true,
    val reminderHour: Int = 8,
    val reminderMinute: Int = 0,
) {
    val hasApiKey: Boolean get() = apiKey.isNotBlank()
}

/**
 * Preferences, including the Anthropic API key.
 *
 * Only the key is encrypted (via [SecretCipher], keyed from the device keystore);
 * reminder times and word counts are not secrets and are stored plainly, which keeps
 * the whole store readable in a bug report without leaking anything.
 *
 * The tradeoff worth stating: a key on the device is right for a personal single-user
 * app, but this APK must not be shared with a key in it, and a rooted or fully
 * compromised phone could still expose it. The remedy then is to rotate the key in
 * the Anthropic console. No backend, no proxy, by choice.
 */
class SettingsStore(context: Context) {

    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    private val _settings = MutableStateFlow(read())
    val settings: StateFlow<Settings> = _settings.asStateFlow()

    fun current(): Settings = _settings.value

    private fun read() = Settings(
        apiKey = prefs.getString(KEY_API, null)?.let(SecretCipher::decrypt).orEmpty(),
        newWordsPerDay = prefs.getInt(KEY_NEW_PER_DAY, 10),
        reminderEnabled = prefs.getBoolean(KEY_REMINDER_ON, true),
        reminderHour = prefs.getInt(KEY_REMINDER_HOUR, 8),
        reminderMinute = prefs.getInt(KEY_REMINDER_MINUTE, 0),
    )

    private fun update(block: SharedPreferences.Editor.() -> Unit) {
        prefs.edit(action = block)
        _settings.value = read()
    }

    fun setApiKey(value: String) = update {
        val trimmed = value.trim()
        if (trimmed.isEmpty()) {
            remove(KEY_API)
        } else {
            putString(KEY_API, SecretCipher.encrypt(trimmed))
        }
    }

    fun setNewWordsPerDay(value: Int) = update { putInt(KEY_NEW_PER_DAY, value.coerceIn(1, 100)) }

    fun setReminderEnabled(value: Boolean) = update { putBoolean(KEY_REMINDER_ON, value) }

    fun setReminderTime(hour: Int, minute: Int) = update {
        putInt(KEY_REMINDER_HOUR, hour.coerceIn(0, 23))
        putInt(KEY_REMINDER_MINUTE, minute.coerceIn(0, 59))
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

    private companion object {
        const val FILE = "tortoisespelling-settings"
        const val KEY_API = "apiKey"
        const val KEY_NEW_PER_DAY = "newWordsPerDay"
        const val KEY_REMINDER_ON = "reminderEnabled"
        const val KEY_REMINDER_HOUR = "reminderHour"
        const val KEY_REMINDER_MINUTE = "reminderMinute"
        const val KEY_SATISFIED_DAYS = "satisfiedDays"
        const val SATISFIED_WINDOW_DAYS = 400L
    }
}
