package io.github.dontpanic345.tortoisespelling.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/** The schema version the app ships; the migration tests walk up to it. */
internal const val DATABASE_VERSION = 2

@Database(entities = [Word::class, ReviewLog::class], version = DATABASE_VERSION, exportSchema = true)
abstract class TortoiseSpellingDatabase : RoomDatabase() {

    abstract fun dao(): TortoiseSpellingDao

    companion object {

        /**
         * Adds the per-word auto-refresh flag and the day its card was last rewritten.
         *
         * Both columns take the same defaults as a newly added word, so every existing
         * word comes through with the feature off and no refresh on record.
         */
        internal val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "ALTER TABLE words ADD COLUMN autoRefresh INTEGER NOT NULL DEFAULT 0",
                )
                db.execSQL("ALTER TABLE words ADD COLUMN refreshedOn INTEGER")
            }
        }

        /** Every migration the builder installs, so the chain test covers each one. */
        internal val ALL_MIGRATIONS: Array<Migration> = arrayOf(MIGRATION_1_2)

        fun build(context: Context): TortoiseSpellingDatabase =
            Room.databaseBuilder(
                context.applicationContext,
                TortoiseSpellingDatabase::class.java,
                "tortoisespelling.db",
            )
                // No fallbackToDestructiveMigration: losing the word list on a schema
                // change is worse than failing loudly. Schemas are exported so real
                // migrations can be written.
                .addMigrations(*ALL_MIGRATIONS)
                .build()
    }
}
