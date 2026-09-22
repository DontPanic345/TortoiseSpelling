package io.github.dontpanic345.tortoisespelling.ui

import android.Manifest
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.platform.LocalContext
import io.github.dontpanic345.tortoisespelling.notify.ReminderScheduler

/**
 * Asks for the Android 13+ notification permission when reminders are on but cannot be
 * posted. Reminders default to on and the system never grants this by itself, so without
 * this ask a fresh install would silently drop every reminder.
 *
 * Only asks once [ready] — i.e. once there are words for a reminder to be about. A refusal
 * turns reminders off, which keeps the Settings switch honest and stops the ask repeating
 * on every visit; the user can turn them back on from Settings.
 */
@Composable
fun RequestNotificationPermissionIfNeeded(ready: Boolean) {
    val context = LocalContext.current
    val settings = rememberAppContainer().settings
    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (!granted) {
            settings.setReminderEnabled(false)
            ReminderScheduler.cancel(context)
        }
    }

    LaunchedEffect(ready) {
        val shouldAsk = ready &&
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            settings.current().reminderEnabled &&
            !ReminderScheduler.canPostNotifications(context)
        if (shouldAsk) {
            launcher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }
}

/** The system screen where a user can re-allow notifications after refusing the prompt. */
fun openNotificationSettings(context: Context) {
    context.startActivity(
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
            .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName),
    )
}

/**
 * The app's System Settings page, one tap from Battery. Some manufacturers (Samsung
 * among them) block a background-scheduled reminder even when the app is exempted from
 * Doze, unless this app's own battery mode is set to Unrestricted rather than Optimised
 * — a setting distinct from, and not implied by, the standard battery-optimisation
 * allowlist. There is no cross-OEM intent straight to that screen, so this is as close
 * as a deep link gets.
 */
fun openAppSettings(context: Context) {
    context.startActivity(
        Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.fromParts("package", context.packageName, null),
        ),
    )
}
