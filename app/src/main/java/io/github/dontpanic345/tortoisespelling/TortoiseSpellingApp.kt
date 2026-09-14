package io.github.dontpanic345.tortoisespelling

import android.app.Application
import io.github.dontpanic345.tortoisespelling.di.AppContainer
import io.github.dontpanic345.tortoisespelling.notify.ReminderScheduler

class TortoiseSpellingApp : Application() {

    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        ReminderScheduler.createChannel(this)
        // Re-assert the schedule on every launch so a dropped or cancelled worker heals.
        ReminderScheduler.ensureScheduled(this, container.settings.current())
    }
}
