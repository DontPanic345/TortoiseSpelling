package com.falloon.tortoisespelling.ui.settings

import android.Manifest
import android.app.TimePickerDialog
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.falloon.tortoisespelling.notify.ReminderScheduler
import com.falloon.tortoisespelling.ui.openNotificationSettings
import com.falloon.tortoisespelling.ui.rememberAppContainer
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val container = rememberAppContainer()
    val viewModel: SettingsViewModel =
        viewModel(factory = SettingsViewModel.factory(context, container))
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbarHost = remember { SnackbarHostState() }
    val coroutineScope = rememberCoroutineScope()
    var keyVisible by remember { mutableStateOf(false) }

    LaunchedEffect(state.message) {
        state.message?.let {
            snackbarHost.showSnackbar(it)
            viewModel.consumeMessage()
        }
    }

    // Permission can be revoked from system settings while this screen is backgrounded,
    // so it is re-read on every resume rather than once.
    var notificationsAllowed by remember {
        mutableStateOf(ReminderScheduler.canPostNotifications(context))
    }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
        notificationsAllowed = ReminderScheduler.canPostNotifications(context)
    }
    // A switch that claims to be on while the system silently drops every notification
    // is worse than an honest off, so it shows whether reminders can actually arrive.
    val remindersOn = state.settings.reminderEnabled && notificationsAllowed

    val notificationPermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        notificationsAllowed = granted
        viewModel.setReminderEnabled(granted)
        if (!granted) {
            // After a second refusal Android stops showing the prompt at all, so the
            // only way back is the system settings page.
            coroutineScope.launch {
                // Explicit duration: with an action, Material 3 defaults to Indefinite,
                // which would park this over the Backup buttons and queue every later
                // message behind it.
                val result = snackbarHost.showSnackbar(
                    message = "Notifications are blocked for TortoiseSpelling.",
                    actionLabel = "Open settings",
                    duration = SnackbarDuration.Long,
                )
                if (result == SnackbarResult.ActionPerformed) {
                    openNotificationSettings(context)
                }
            }
        }
    }

    val exportLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/json"),
    ) { uri ->
        uri?.let(viewModel::exportTo)
    }

    val importLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument(),
    ) { uri ->
        uri?.let(viewModel::importFrom)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbarHost) },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            SectionTitle("Claude lookup")

            Text(
                text = "Optional. With a key, “Look up with Claude” fills in the " +
                    "definition and example when you add a word. Without one, you type " +
                    "those yourself.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            OutlinedTextField(
                value = state.settings.apiKey,
                onValueChange = viewModel::setApiKey,
                label = { Text("Anthropic API key") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                visualTransformation = if (keyVisible) {
                    VisualTransformation.None
                } else {
                    PasswordVisualTransformation()
                },
                trailingIcon = {
                    IconButton(onClick = { keyVisible = !keyVisible }) {
                        Icon(
                            imageVector = if (keyVisible) {
                                Icons.Default.VisibilityOff
                            } else {
                                Icons.Default.Visibility
                            },
                            contentDescription = if (keyVisible) "Hide key" else "Show key",
                        )
                    }
                },
            )
            Text(
                text = "Stored encrypted on this device only. Never share this build with " +
                    "your key in it; if it ever leaks, rotate it in the Anthropic console.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            OutlinedButton(onClick = viewModel::testKey, enabled = !state.testingKey) {
                if (state.testingKey) {
                    CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.size(8.dp))
                }
                Text("Test key")
            }

            ApiKeyHelp()

            HorizontalDivider(Modifier.padding(vertical = 8.dp))
            SectionTitle("Practice")

            Stepper(
                label = "New words per day",
                value = state.settings.newWordsPerDay,
                onChange = viewModel::setNewWordsPerDay,
            )

            HorizontalDivider(Modifier.padding(vertical = 8.dp))
            SectionTitle("Daily reminder")

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text("Remind me daily", style = MaterialTheme.typography.bodyLarge)
                Switch(
                    checked = remindersOn,
                    onCheckedChange = { enabled ->
                        if (enabled && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
                        } else {
                            viewModel.setReminderEnabled(enabled)
                        }
                    },
                )
            }

            val hour = state.settings.reminderHour
            val minute = state.settings.reminderMinute
            OutlinedButton(
                onClick = {
                    TimePickerDialog(
                        context,
                        { _, pickedHour, pickedMinute ->
                            viewModel.setReminderTime(pickedHour, pickedMinute)
                        },
                        hour,
                        minute,
                        true,
                    ).show()
                },
                enabled = remindersOn,
            ) {
                Text("Reminder time: %02d:%02d".format(hour, minute))
            }

            TextButton(onClick = viewModel::sendTestNotification) {
                Text("Send a test notification")
            }

            HorizontalDivider(Modifier.padding(vertical = 8.dp))
            SectionTitle("Backup")

            Text(
                text = "Your word list and its scheduling. Importing adds words you don't " +
                    "already have and leaves existing ones untouched.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(
                    onClick = { exportLauncher.launch("tortoisespelling-backup.json") },
                    enabled = !state.busy,
                ) {
                    Text("Export")
                }
                OutlinedButton(
                    onClick = { importLauncher.launch(arrayOf("application/json", "text/plain")) },
                    enabled = !state.busy,
                ) {
                    Text("Import")
                }
            }

            Spacer(Modifier.height(32.dp))
        }
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.titleSmall,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(top = 8.dp),
    )
}

@Composable
private fun ApiKeyHelp() {
    val uriHandler = LocalUriHandler.current
    Column {
        Text(
            text = "No key yet? Sign in at console.anthropic.com, open " +
                "Settings → API keys → Create key, then add a little credit under " +
                "Billing. Lookups use the cheapest model and cost well under a cent each.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        TextButton(
            onClick = { uriHandler.openUri("https://console.anthropic.com/settings/keys") },
            contentPadding = PaddingValues(vertical = 4.dp),
        ) {
            Text("Open the Anthropic console")
        }
    }
}

@Composable
private fun Stepper(label: String, value: Int, onChange: (Int) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, style = MaterialTheme.typography.bodyLarge)
        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedButton(onClick = { onChange(value - 1) }, enabled = value > 1) { Text("−") }
            Text(
                text = value.toString(),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(horizontal = 16.dp),
            )
            OutlinedButton(onClick = { onChange(value + 1) }, enabled = value < 100) { Text("+") }
        }
    }
}
