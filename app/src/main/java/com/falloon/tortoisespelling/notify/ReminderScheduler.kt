package com.falloon.tortoisespelling.notify

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
import com.falloon.tortoisespelling.data.Settings
import com.falloon.tortoisespelling.domain.millisUntilNext
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

    /** Enqueue or cancel to match [settings], replacing any pending run. For settings changes. */
    fun sync(context: Context, settings: Settings) {
        if (!settings.reminderEnabled) {
            cancel(context)
            return
        }
        schedule(context, millisUntilNext(settings.reminderHour, settings.reminderMinute))
    }

    /**
     * Book a reminder only if none is pending. For app start, to heal a dropped schedule.
     *
     * This must not replace: WorkManager cold-starts the process to run the reminder, so
     * Application.onCreate runs just before the worker would. By then the target time has
     * passed, and a replace would cancel today's run in favour of tomorrow's — every day.
     */
    fun ensureScheduled(context: Context, settings: Settings) {
        if (!settings.reminderEnabled) {
            cancel(context)
            return
        }
        schedule(
            context,
            millisUntilNext(settings.reminderHour, settings.reminderMinute),
            ExistingWorkPolicy.KEEP,
        )
    }

    fun schedule(
        context: Context,
        delayMillis: Long,
        policy: ExistingWorkPolicy = ExistingWorkPolicy.REPLACE,
    ) {
        val request = OneTimeWorkRequestBuilder<ReminderWorker>()
            .setInitialDelay(delayMillis, TimeUnit.MILLISECONDS)
            .build()
        WorkManager.getInstance(context)
            .enqueueUniqueWork(UNIQUE_WORK, policy, request)
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
