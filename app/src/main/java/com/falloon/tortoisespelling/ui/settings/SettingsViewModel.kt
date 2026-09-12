package com.falloon.tortoisespelling.ui.settings

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.falloon.tortoisespelling.data.BackupFile
import com.falloon.tortoisespelling.data.BackupFormatException
import com.falloon.tortoisespelling.data.BackupJson
import com.falloon.tortoisespelling.data.Settings
import com.falloon.tortoisespelling.data.SettingsStore
import com.falloon.tortoisespelling.data.WordRepository
import com.falloon.tortoisespelling.data.parseBackup
import com.falloon.tortoisespelling.data.remote.ClaudeClient
import com.falloon.tortoisespelling.data.remote.KeyTestResult
import com.falloon.tortoisespelling.data.toBackup
import com.falloon.tortoisespelling.data.toWord
import com.falloon.tortoisespelling.di.AppContainer
import com.falloon.tortoisespelling.notify.ReminderScheduler
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class SettingsUiState(
    val settings: Settings = Settings(),
    val testingKey: Boolean = false,
    val busy: Boolean = false,
    val message: String? = null,
)

class SettingsViewModel(
    private val context: Context,
    private val store: SettingsStore,
    private val repository: WordRepository,
    private val claude: ClaudeClient,
) : ViewModel() {

    private val _state = MutableStateFlow(SettingsUiState(store.current()))
    val state: StateFlow<SettingsUiState> = _state.asStateFlow()

    private fun publish(settings: Settings = store.current()) {
        _state.value = _state.value.copy(settings = settings)
    }

    fun consumeMessage() {
        _state.value = _state.value.copy(message = null)
    }

    private fun say(message: String) {
        _state.value = _state.value.copy(message = message)
    }

    fun setApiKey(value: String) {
        store.setApiKey(value)
        publish()
    }

    fun setNewWordsPerDay(value: Int) {
        store.setNewWordsPerDay(value)
        publish()
    }

    fun setReminderEnabled(enabled: Boolean) {
        store.setReminderEnabled(enabled)
        val settings = store.current()
        publish(settings)
        ReminderScheduler.sync(context, settings)
    }

    fun setReminderTime(hour: Int, minute: Int) {
        store.setReminderTime(hour, minute)
        val settings = store.current()
        publish(settings)
        // Rescheduling here is what makes a changed time take effect; without it the
        // worker would keep its old target until the next launch.
        ReminderScheduler.sync(context, settings)
    }

    fun testKey() {
        val settings = store.current()
        if (!settings.hasApiKey) {
            say("Enter a key first.")
            return
        }
        _state.value = _state.value.copy(testingKey = true)
        viewModelScope.launch {
            val result = claude.testKey(settings.apiKey)
            _state.value = _state.value.copy(
                testingKey = false,
                message = when (result) {
                    KeyTestResult.Ok -> "Key works."
                    KeyTestResult.Rejected -> "Key rejected (401). Check it and try again."
                    is KeyTestResult.Failure -> result.message
                },
            )
        }
    }

    fun sendTestNotification() {
        if (!ReminderScheduler.canPostNotifications(context)) {
            say("Notifications are blocked for TortoiseSpelling in Android settings.")
            return
        }
        // Fire the real worker path rather than a bespoke notification, so this actually
        // tests what runs each morning.
        ReminderScheduler.sendTestNow(context)
        say("Test reminder queued.")
    }

    fun buildBackupJson(onReady: (String) -> Unit) {
        viewModelScope.launch {
            val words = repository.exportAll()
            val backup = BackupFile(words = words.map { it.toBackup() })
            onReady(BackupJson.encodeToString(BackupFile.serializer(), backup))
        }
    }

    fun importBackupJson(raw: String) {
        _state.value = _state.value.copy(busy = true)
        viewModelScope.launch {
            try {
                val backup = parseBackup(raw)
                val summary = repository.importWords(backup.words.map { it.toWord() })
                _state.value = _state.value.copy(
                    busy = false,
                    message = buildString {
                        append("Imported ${summary.added} word")
                        if (summary.added != 1) append("s")
                        if (summary.skipped > 0) {
                            append(", skipped ${summary.skipped} already in your list")
                        }
                        append(".")
                    },
                )
            } catch (error: BackupFormatException) {
                _state.value = _state.value.copy(busy = false, message = error.message)
            } catch (error: Exception) {
                _state.value = _state.value.copy(busy = false, message = "Couldn't read that file.")
            }
        }
    }

    fun exportFailed() = say("Couldn't write that file.")

    fun exportSucceeded() = say("Backup saved.")

    companion object {
        fun factory(context: Context, container: AppContainer): ViewModelProvider.Factory =
            viewModelFactory {
                initializer {
                    SettingsViewModel(
                        context.applicationContext,
                        container.settings,
                        container.repository,
                        container.claude,
                    )
                }
            }
    }
}
