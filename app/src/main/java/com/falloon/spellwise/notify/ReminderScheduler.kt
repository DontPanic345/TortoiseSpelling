package com.falloon.spellwise.notify

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import com.falloon.spellwise.data.Settings
import com.falloon.spellwise.domain.millisUntilNext
import java.util.concurrent.TimeUnit

/**
 * Schedules the daily nudge.
 *
 * Uses a self-rescheduling one-shot rather than PeriodicWorkRequest. A periodic
 * request re-fires 24h after each *actual* run, so every Doze delay permanently
 * shifts the reminder later; re-targeting an absolute clock time each run keeps it
 * pinned. Exact alarms are avoided deliberately — "within a few minutes" is fine for
 * a habit nudge and does not cost the user a permission prompt.
 */
object ReminderScheduler {

    const val CHANNEL_ID = "reminders"
    const val NOTIFICATION_ID = 1001
    const val UNIQUE_WORK = "daily-reminder"

    fun createChannel(context: Context) {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Daily practice reminders",
            NotificationManager.IMPORTANCE_DEFAULT,
        ).apply {
            description = "A nudge when you have words to practice."
        }
        context.getSystemService(NotificationManager::class.java)
            ?.createNotificationChannel(channel)
    }

    /** Enqueue or cancel to match [settings]. Safe to call repeatedly. */
    fun sync(context: Context, settings: Settings) {
        if (!settings.reminderEnabled) {
            cancel(context)
            return
        }
        schedule(context, millisUntilNext(settings.reminderHour, settings.reminderMinute))
    }

    fun schedule(context: Context, delayMillis: Long) {
        val request = OneTimeWorkRequestBuilder<ReminderWorker>()
            .setInitialDelay(delayMillis, TimeUnit.MILLISECONDS)
            .build()
        WorkManager.getInstance(context)
            .enqueueUniqueWork(UNIQUE_WORK, ExistingWorkPolicy.REPLACE, request)
    }

    /**
     * Runs the real reminder path once, right now.
     *
     * Enqueued without the unique name so it cannot displace the daily schedule.
     */
    fun sendTestNow(context: Context) {
        val request = OneTimeWorkRequestBuilder<ReminderWorker>()
            .setInputData(workDataOf(ReminderWorker.KEY_TEST_RUN to true))
            .build()
        WorkManager.getInstance(context).enqueue(request)
    }

    fun cancel(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(UNIQUE_WORK)
    }

    fun canPostNotifications(context: Context): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS,
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
}
