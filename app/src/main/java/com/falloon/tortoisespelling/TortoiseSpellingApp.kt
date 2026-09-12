package com.falloon.tortoisespelling

import android.app.Application
import com.falloon.tortoisespelling.di.AppContainer
import com.falloon.tortoisespelling.notify.ReminderScheduler

class TortoiseSpellingApp : Application() {

    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        ReminderScheduler.createChannel(this)
        // Re-assert the schedule on every launch so a dropped or cancelled worker heals.
        ReminderScheduler.sync(this, container.settings.current())
    }
}
