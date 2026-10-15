package io.github.dontpanic345.tortoisespelling.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/** The schema version the app ships; the migration tests walk up to it. */
internal const val DATABASE_VERSION = 4

@Database(
    entities = [
        Word::class,
        ReviewLog::class,
        Definition::class,
        WordForm::class,
        ExampleSentence::class,
    ],
    version = DATABASE_VERSION,
    exportSchema = true,
)
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

        /**
         * Moves each word's definition, example and part of speech into the new
         * `definitions`, `word_forms` and `example_sentences` tables: one definition, the
         * base form and, unless the example was blank, one example per word, each reusing
         * the word's id. Then rebuilds `words` without the three columns, since SQLite
         * only has `DROP COLUMN` from API 34.
         *
         * Room turns foreign keys on after migrations run, so dropping the old `words`
         * doesn't cascade into `review_log` or the new tables.
         */
        internal val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `definitions` (`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                        "`wordId` INTEGER NOT NULL, `text` TEXT NOT NULL, `partOfSpeech` TEXT, " +
                        "`orderIndex` INTEGER NOT NULL, " +
                        "FOREIGN KEY(`wordId`) REFERENCES `words`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE )",
                )
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_definitions_wordId` ON `definitions` (`wordId`)")
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `word_forms` (`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                        "`definitionId` INTEGER NOT NULL, `text` TEXT NOT NULL, `label` TEXT, " +
                        "`orderIndex` INTEGER NOT NULL, " +
                        "FOREIGN KEY(`definitionId`) REFERENCES `definitions`(`id`) " +
                        "ON UPDATE NO ACTION ON DELETE CASCADE )",
                )
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_word_forms_definitionId` ON `word_forms` (`definitionId`)")
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `example_sentences` (`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                        "`wordFormId` INTEGER NOT NULL, `text` TEXT NOT NULL, `orderIndex` INTEGER NOT NULL, " +
                        "`shownAt` INTEGER, " +
                        "FOREIGN KEY(`wordFormId`) REFERENCES `word_forms`(`id`) " +
                        "ON UPDATE NO ACTION ON DELETE CASCADE )",
                )
                db.execSQL(
                    "CREATE INDEX IF NOT EXISTS `index_example_sentences_wordFormId` " +
                        "ON `example_sentences` (`wordFormId`)",
                )

                db.execSQL(
                    "INSERT INTO definitions (id, wordId, text, partOfSpeech, orderIndex) " +
                        "SELECT id, id, definition, NULLIF(TRIM(partOfSpeech), ''), 0 FROM words",
                )
                db.execSQL(
                    "INSERT INTO word_forms (id, definitionId, text, label, orderIndex) " +
                        "SELECT id, id, text, NULL, 0 FROM words",
                )
                db.execSQL(
                    "INSERT INTO example_sentences (id, wordFormId, text, orderIndex, shownAt) " +
                        "SELECT id, id, example, 0, NULL FROM words WHERE trim(example) != ''",
                )

                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `_new_words` (`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                        "`text` TEXT NOT NULL, `normalizedText` TEXT NOT NULL, `createdAt` INTEGER NOT NULL, " +
                        "`repetitions` INTEGER NOT NULL, `easeFactor` REAL NOT NULL, `intervalDays` INTEGER NOT NULL, " +
                        "`dueOn` INTEGER NOT NULL, `lapses` INTEGER NOT NULL, `lastReviewedAt` INTEGER, " +
                        "`firstReviewedOn` INTEGER, `isNew` INTEGER NOT NULL, `suspended` INTEGER NOT NULL, " +
                        "`autoRefresh` INTEGER NOT NULL, `refreshedOn` INTEGER)",
                )
                db.execSQL(
                    "INSERT INTO `_new_words` (`id`, `text`, `normalizedText`, `createdAt`, `repetitions`, " +
                        "`easeFactor`, `intervalDays`, `dueOn`, `lapses`, `lastReviewedAt`, `firstReviewedOn`, " +
                        "`isNew`, `suspended`, `autoRefresh`, `refreshedOn`) " +
                        "SELECT `id`, `text`, `normalizedText`, `createdAt`, `repetitions`, " +
                        "`easeFactor`, `intervalDays`, `dueOn`, `lapses`, `lastReviewedAt`, `firstReviewedOn`, " +
                        "`isNew`, `suspended`, `autoRefresh`, `refreshedOn` FROM `words`",
                )
                db.execSQL("DROP TABLE `words`")
                db.execSQL("ALTER TABLE `_new_words` RENAME TO `words`")
                db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS `index_words_normalizedText` ON `words` (`normalizedText`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_words_dueOn` ON `words` (`dueOn`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_words_firstReviewedOn` ON `words` (`firstReviewedOn`)")
            }
        }

        /**
         * Drops `autoRefresh` and `refreshedOn` with the card refresh. Rebuilds `words` as
         * [MIGRATION_2_3] does.
         */
        internal val MIGRATION_3_4 = object : Migration(3, 4) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `_new_words` (`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                        "`text` TEXT NOT NULL, `normalizedText` TEXT NOT NULL, `createdAt` INTEGER NOT NULL, " +
                        "`repetitions` INTEGER NOT NULL, `easeFactor` REAL NOT NULL, `intervalDays` INTEGER NOT NULL, " +
                        "`dueOn` INTEGER NOT NULL, `lapses` INTEGER NOT NULL, `lastReviewedAt` INTEGER, " +
                        "`firstReviewedOn` INTEGER, `isNew` INTEGER NOT NULL, `suspended` INTEGER NOT NULL)",
                )
                db.execSQL(
                    "INSERT INTO `_new_words` (`id`, `text`, `normalizedText`, `createdAt`, `repetitions`, " +
                        "`easeFactor`, `intervalDays`, `dueOn`, `lapses`, `lastReviewedAt`, `firstReviewedOn`, " +
                        "`isNew`, `suspended`) " +
                        "SELECT `id`, `text`, `normalizedText`, `createdAt`, `repetitions`, " +
                        "`easeFactor`, `intervalDays`, `dueOn`, `lapses`, `lastReviewedAt`, `firstReviewedOn`, " +
                        "`isNew`, `suspended` FROM `words`",
                )
                db.execSQL("DROP TABLE `words`")
                db.execSQL("ALTER TABLE `_new_words` RENAME TO `words`")
                db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS `index_words_normalizedText` ON `words` (`normalizedText`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_words_dueOn` ON `words` (`dueOn`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_words_firstReviewedOn` ON `words` (`firstReviewedOn`)")
            }
        }

        /** Every migration the builder installs, so the chain test covers each one. */
        internal val ALL_MIGRATIONS: Array<Migration> = arrayOf(MIGRATION_1_2, MIGRATION_2_3, MIGRATION_3_4)

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
