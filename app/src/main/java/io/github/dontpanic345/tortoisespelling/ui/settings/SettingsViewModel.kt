package io.github.dontpanic345.tortoisespelling.ui.settings

import android.app.backup.BackupManager
import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import io.github.dontpanic345.tortoisespelling.data.BackupFile
import io.github.dontpanic345.tortoisespelling.data.BackupFormatException
import io.github.dontpanic345.tortoisespelling.data.BackupJson
import io.github.dontpanic345.tortoisespelling.data.Settings
import io.github.dontpanic345.tortoisespelling.data.SettingsStore
import io.github.dontpanic345.tortoisespelling.data.WordRepository
import io.github.dontpanic345.tortoisespelling.data.parseBackup
import io.github.dontpanic345.tortoisespelling.data.remote.ClaudeClient
import io.github.dontpanic345.tortoisespelling.data.remote.KeyTestResult
import io.github.dontpanic345.tortoisespelling.data.toBackup
import io.github.dontpanic345.tortoisespelling.data.toWord
import io.github.dontpanic345.tortoisespelling.di.AppContainer
import io.github.dontpanic345.tortoisespelling.notify.ReminderScheduler
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.IOException

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
        _state.update { it.copy(settings = settings) }
    }

    fun consumeMessage() {
        _state.update { it.copy(message = null) }
    }

    private fun say(message: String) {
        _state.update { it.copy(message = message) }
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

    fun setCloudBackupEnabled(enabled: Boolean) {
        store.setCloudBackupEnabled(enabled)
        publish()
        // Tells the system there is new data to back up, so the next scheduled Auto
        // Backup pass picks up the change instead of waiting for one to happen anyway.
        BackupManager(context).dataChanged()
    }

    fun testKey() {
        val settings = store.current()
        if (!settings.hasApiKey) {
            say("Enter a key first.")
            return
        }
        _state.update { it.copy(testingKey = true) }
        viewModelScope.launch {
            val result = claude.testKey(settings.apiKey)
            _state.update {
                it.copy(
                    testingKey = false,
                    message = when (result) {
                        KeyTestResult.Ok -> "Key works."
                        KeyTestResult.Rejected -> "Key rejected (401). Check it and try again."
                        is KeyTestResult.Failure -> result.message
                    },
                )
            }
        }
    }

    fun sendTestNotification() {
        if (!ReminderScheduler.canPostNotifications(context)) {
            say("Notifications are blocked for Tortoise Spelling in Android settings.")
            return
        }
        // Fire the real worker path rather than a bespoke notification, so this actually
        // tests what runs each morning.
        ReminderScheduler.sendTestNow(context)
        say("Test reminder queued.")
    }

    // Backup file I/O runs on Dispatchers.IO: the chosen document may live with a cloud
    // provider such as Google Drive, whose streams can block on the network for seconds.

    fun exportTo(uri: Uri) {
        _state.update { it.copy(busy = true) }
        viewModelScope.launch {
            val message = try {
                val backup = BackupFile(words = repository.exportAll().map { it.toBackup() })
                val json = BackupJson.encodeToString(BackupFile.serializer(), backup)
                withContext(Dispatchers.IO) {
                    // "wt" truncates: plain "w" can leave a longer old file's tail behind.
                    val stream = context.contentResolver.openOutputStream(uri, "wt")
                        ?: throw IOException("No output stream for $uri")
                    stream.use { it.write(json.toByteArray()) }
                }
                "Backup saved."
            } catch (error: Exception) {
                "Couldn't write that file."
            }
            _state.update { it.copy(busy = false, message = message) }
        }
    }

    fun importFrom(uri: Uri) {
        _state.update { it.copy(busy = true) }
        viewModelScope.launch {
            val message = try {
                val raw = withContext(Dispatchers.IO) {
                    val stream = context.contentResolver.openInputStream(uri)
                        ?: throw IOException("No input stream for $uri")
                    stream.bufferedReader().use { it.readText() }
                }
                val backup = parseBackup(raw)
                val summary = repository.importWords(backup.words.map { it.toWord() })
                buildString {
                    append("Imported ${summary.added} word")
                    if (summary.added != 1) {
                        append("s")
                    }
                    if (summary.skipped > 0) {
                        append(", skipped ${summary.skipped} already in your list")
                    }
                    append(".")
                }
            } catch (error: BackupFormatException) {
                error.message
            } catch (error: Exception) {
                "Couldn't read that file."
            }
            _state.update { it.copy(busy = false, message = message) }
        }
    }

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
