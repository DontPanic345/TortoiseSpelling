package io.github.dontpanic345.tortoisespelling.ui.settings

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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import io.github.dontpanic345.tortoisespelling.BuildConfig
import io.github.dontpanic345.tortoisespelling.notify.ReminderScheduler
import io.github.dontpanic345.tortoisespelling.ui.BackButton
import io.github.dontpanic345.tortoisespelling.ui.TestTags
import io.github.dontpanic345.tortoisespelling.ui.openAppSettings
import io.github.dontpanic345.tortoisespelling.ui.openNotificationSettings
import io.github.dontpanic345.tortoisespelling.ui.rememberAppContainer
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
                    message = "Notifications are blocked for Tortoise Spelling.",
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
                navigationIcon = { BackButton(onClick = onBack) },
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
            ReminderSection(
                enabled = remindersOn,
                hour = state.settings.reminderHour,
                minute = state.settings.reminderMinute,
                onToggle = { wantOn ->
                    if (wantOn && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
                    } else {
                        viewModel.setReminderEnabled(wantOn)
                    }
                },
                onPickTime = viewModel::setReminderTime,
                onSendTest = viewModel::sendTestNotification,
            )

            SectionDivider()
            PracticeSection(
                newWordsPerDay = state.settings.newWordsPerDay,
                onChange = viewModel::setNewWordsPerDay,
            )

            SectionDivider()
            ClaudeLookupSection(
                apiKey = state.settings.apiKey,
                onApiKeyChange = viewModel::setApiKey,
                testing = state.testingKey,
                onTestKey = viewModel::testKey,
            )

            SectionDivider()
            BackupSection(
                busy = state.busy,
                cloudBackupEnabled = state.settings.cloudBackupEnabled,
                onExport = { exportLauncher.launch("tortoisespelling-backup.json") },
                onImport = { importLauncher.launch(arrayOf("application/json", "text/plain")) },
                onCloudBackupChange = viewModel::setCloudBackupEnabled,
            )

            SectionDivider()
            AboutSection()

            Spacer(Modifier.height(32.dp))
        }
    }
}

@Composable
private fun ReminderSection(
    enabled: Boolean,
    hour: Int,
    minute: Int,
    onToggle: (Boolean) -> Unit,
    onPickTime: (Int, Int) -> Unit,
    onSendTest: () -> Unit,
) {
    val context = LocalContext.current
    SectionTitle("Daily reminder")

    SwitchRow(
        label = "Remind me daily",
        checked = enabled,
        onCheckedChange = onToggle,
        testTag = TestTags.SETTINGS_REMINDER_SWITCH,
    )

    OutlinedButton(
        onClick = {
            TimePickerDialog(
                context,
                { _, pickedHour, pickedMinute -> onPickTime(pickedHour, pickedMinute) },
                hour,
                minute,
                true,
            ).show()
        },
        enabled = enabled,
        modifier = Modifier.testTag(TestTags.SETTINGS_REMINDER_TIME_BUTTON),
    ) {
        Text("Reminder time: %02d:%02d".format(hour, minute))
    }

    TextButton(onClick = onSendTest) {
        Text("Send a test notification")
    }

    HelpText(
        "If reminders arrive while the app is open but not once it's closed, your " +
            "phone's battery settings are blocking them regardless of the switch above. " +
            "Set this app's battery use to Unrestricted, not Optimised — some " +
            "manufacturers (Samsung included) throttle background reminders otherwise.",
    )
    TextButton(onClick = { openAppSettings(context) }) {
        Text("Open app settings")
    }
}

@Composable
private fun PracticeSection(newWordsPerDay: Int, onChange: (Int) -> Unit) {
    SectionTitle("Practice")
    Stepper(
        label = "New words per day",
        value = newWordsPerDay,
        onChange = onChange,
    )
}

@Composable
private fun ClaudeLookupSection(
    apiKey: String,
    onApiKeyChange: (String) -> Unit,
    testing: Boolean,
    onTestKey: () -> Unit,
) {
    var keyVisible by remember { mutableStateOf(false) }

    SectionTitle("Claude lookup")
    HelpText(
        "Optional. With a key, “Look up with Claude” fills in the definition and " +
            "example when you add a word. Without one, you type those yourself.",
    )

    OutlinedTextField(
        value = apiKey,
        onValueChange = onApiKeyChange,
        label = { Text("Anthropic API key") },
        singleLine = true,
        modifier = Modifier
            .fillMaxWidth()
            .testTag(TestTags.SETTINGS_API_KEY),
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
    HelpText(
        "Anyone with this key can spend your Anthropic credit. If it leaks, delete it " +
            "in the Anthropic console.",
    )

    OutlinedButton(onClick = onTestKey, enabled = !testing) {
        if (testing) {
            CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
            Spacer(Modifier.size(8.dp))
        }
        Text("Test key")
    }

    ApiKeyHelp()
}

@Composable
private fun BackupSection(
    busy: Boolean,
    cloudBackupEnabled: Boolean,
    onExport: () -> Unit,
    onImport: () -> Unit,
    onCloudBackupChange: (Boolean) -> Unit,
) {
    SectionTitle("Backup")
    HelpText(
        "Your word list and its scheduling. Importing adds words you don't already have " +
            "and leaves existing ones untouched.",
    )
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedButton(onClick = onExport, enabled = !busy) {
            Text("Export")
        }
        OutlinedButton(onClick = onImport, enabled = !busy) {
            Text("Import")
        }
    }

    SwitchRow(
        label = "Back up to Google account",
        checked = cloudBackupEnabled,
        onCheckedChange = onCloudBackupChange,
        testTag = TestTags.SETTINGS_CLOUD_BACKUP_SWITCH,
    )
    HelpText(
        "Includes your words and settings in your phone's Google backup, so they come " +
            "back after a reset or on a new phone. This is separate from Export. Your " +
            "Anthropic API key is never restored this way, because it's locked to this phone.",
    )
}

@Composable
private fun AboutSection() {
    val uriHandler = LocalUriHandler.current
    SectionTitle("About")
    Column {
        Text(
            text = "Tortoise Spelling ${BuildConfig.VERSION_NAME}",
            style = MaterialTheme.typography.bodyLarge,
        )
        HelpText(
            "Free and open source under the MIT licence. No ads, no accounts, no " +
                "tracking: your words stay on this device.",
        )
        Row {
            TextButton(
                onClick = { uriHandler.openUri(PRIVACY_POLICY_URL) },
                contentPadding = PaddingValues(vertical = 4.dp),
            ) {
                Text("Privacy policy")
            }
            Spacer(Modifier.size(16.dp))
            TextButton(
                onClick = { uriHandler.openUri(SOURCE_CODE_URL) },
                contentPadding = PaddingValues(vertical = 4.dp),
            ) {
                Text("Source code")
            }
        }
    }
}

@Composable
private fun ApiKeyHelp() {
    val uriHandler = LocalUriHandler.current
    Column {
        HelpText(
            "No key yet? Sign in at console.anthropic.com, open Settings → API keys → " +
                "Create key, then add a little credit under Billing. Lookups use the " +
                "cheapest model and cost well under a cent each.",
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
private fun SectionTitle(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.titleSmall,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(top = 8.dp),
    )
}

@Composable
private fun SectionDivider() {
    HorizontalDivider(Modifier.padding(vertical = 8.dp))
}

/** The explanatory small print that sits under a setting. */
@Composable
private fun HelpText(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

@Composable
private fun SwitchRow(
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    testTag: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, style = MaterialTheme.typography.bodyLarge)
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            modifier = Modifier.testTag(testTag),
        )
    }
}

private const val SOURCE_CODE_URL = "https://github.com/DontPanic345/TortoiseSpelling"
private const val PRIVACY_POLICY_URL = "$SOURCE_CODE_URL/blob/main/PRIVACY.md"

@Composable
private fun Stepper(label: String, value: Int, onChange: (Int) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, style = MaterialTheme.typography.bodyLarge)
        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedButton(
                onClick = { onChange(value - 1) },
                enabled = value > 1,
                modifier = Modifier.testTag(TestTags.SETTINGS_NEW_WORDS_DECREASE),
            ) { Text("−") }
            Text(
                text = value.toString(),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier
                    .padding(horizontal = 16.dp)
                    .testTag(TestTags.SETTINGS_NEW_WORDS_VALUE),
            )
            OutlinedButton(
                onClick = { onChange(value + 1) },
                enabled = value < 100,
                modifier = Modifier.testTag(TestTags.SETTINGS_NEW_WORDS_INCREASE),
            ) { Text("+") }
        }
    }
}
