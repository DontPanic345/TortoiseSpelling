package com.falloon.spellwise

import android.app.Application
import com.falloon.spellwise.di.AppContainer
import com.falloon.spellwise.notify.ReminderScheduler

class SpellwiseApp : Application() {

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
