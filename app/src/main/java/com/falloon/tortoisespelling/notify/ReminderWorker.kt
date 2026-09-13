package com.falloon.tortoisespelling.notify

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.falloon.tortoisespelling.MainActivity
import com.falloon.tortoisespelling.R
import com.falloon.tortoisespelling.TortoiseSpellingApp
import com.falloon.tortoisespelling.domain.millisUntilNext

/**
 * Posts the daily reminder, then books the next one.
 *
 * Rescheduling happens whatever the outcome, so one failed or silent day cannot end
 * the habit loop for good.
 */
class ReminderWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val app = applicationContext as TortoiseSpellingApp
        val settings = app.container.settings.current()
        val isTest = inputData.getBoolean(KEY_TEST_RUN, false)

        if (!settings.reminderEnabled && !isTest) {
            return Result.success()
        }

        try {
            val plan = app.container.repository.todayPlan()
            when {
                plan.total > 0 -> notify(plan.total)

                // A test must always produce something visible. Staying silent because
                // nothing happens to be due is indistinguishable from being broken,
                // which is the one thing this button exists to rule out.
                isTest -> notify(count = 0)

                // Nothing was due. Record it so the day bridges the streak rather than
                // breaking it. This runs even if the app is never opened.
                else -> app.container.repository.markTodaySatisfied()
            }
        } finally {
            // A test run is a one-off and must not disturb the real schedule.
            if (!isTest && settings.reminderEnabled) {
                ReminderScheduler.schedule(
                    applicationContext,
                    millisUntilNext(settings.reminderHour, settings.reminderMinute),
                )
            }
        }
        return Result.success()
    }

    private fun notify(count: Int) {
        if (!ReminderScheduler.canPostNotifications(applicationContext)) {
            return
        }
        val intent = Intent(applicationContext, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(MainActivity.EXTRA_START_REVIEW, true)
        }
        val pending = PendingIntent.getActivity(
            applicationContext,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(applicationContext, ReminderScheduler.CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(
                if (count == 0) "Reminders are working" else "Time to practice spelling",
            )
            .setContentText(
                when (count) {
                    0 -> "Nothing is due right now."
                    1 -> "1 word ready"
                    else -> "$count words ready"
                },
            )
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(pending)
            .build()

        // The permission can be revoked between the check above and this call, and then
        // posting throws. Today's notification is lost either way; swallowing it lets the
        // run end as a success, and doWork's finally books tomorrow's run regardless.
        try {
            NotificationManagerCompat.from(applicationContext)
                .notify(ReminderScheduler.NOTIFICATION_ID, notification)
        } catch (ignored: SecurityException) {
        }
    }

    companion object {
        /** Marks a one-off run from the Settings "test notification" button. */
        const val KEY_TEST_RUN = "testRun"
    }
}
