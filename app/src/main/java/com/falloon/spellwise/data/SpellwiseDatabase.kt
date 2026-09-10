package com.falloon.spellwise.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [Word::class, ReviewLog::class], version = 1, exportSchema = true)
abstract class SpellwiseDatabase : RoomDatabase() {

    abstract fun dao(): SpellwiseDao

    companion object {
        fun build(context: Context): SpellwiseDatabase =
            Room.databaseBuilder(
                context.applicationContext,
                SpellwiseDatabase::class.java,
                "spellwise.db",
            )
                // No fallbackToDestructiveMigration: losing the word list on a schema
                // change is worse than failing loudly. Schemas are exported so real
                // migrations can be written.
                .build()
    }
}
