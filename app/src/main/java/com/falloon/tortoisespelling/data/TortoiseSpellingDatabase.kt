package com.falloon.tortoisespelling.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [Word::class, ReviewLog::class], version = 1, exportSchema = true)
abstract class TortoiseSpellingDatabase : RoomDatabase() {

    abstract fun dao(): TortoiseSpellingDao

    companion object {
        fun build(context: Context): TortoiseSpellingDatabase =
            Room.databaseBuilder(
                context.applicationContext,
                TortoiseSpellingDatabase::class.java,
                "tortoisespelling.db",
            )
                // No fallbackToDestructiveMigration: losing the word list on a schema
                // change is worse than failing loudly. Schemas are exported so real
                // migrations can be written.
                .build()
    }
}
