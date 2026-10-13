package io.github.dontpanic345.tortoisespelling.data

import android.content.ContentValues
import androidx.room.Room
import androidx.room.testing.MigrationTestHelper
import androidx.sqlite.db.SupportSQLiteDatabase
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import io.github.dontpanic345.tortoisespelling.data.TortoiseSpellingDatabase.Companion.ALL_MIGRATIONS
import io.github.dontpanic345.tortoisespelling.data.TortoiseSpellingDatabase.Companion.MIGRATION_1_2
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MigrationTest {

    @get:Rule
    val helper = MigrationTestHelper(
        InstrumentationRegistry.getInstrumentation(),
        TortoiseSpellingDatabase::class.java,
    )

    private val dbName = "migration-test.db"

    private fun seedVersion1(db: SupportSQLiteDatabase) {
        fun word(
            id: Long,
            text: String,
            partOfSpeech: String?,
            createdAt: Long,
            repetitions: Int,
            easeFactor: Double,
            intervalDays: Int,
            dueOn: Long,
            lapses: Int,
            lastReviewedAt: Long?,
            firstReviewedOn: Long?,
            isNew: Int,
            suspended: Int,
        ) {
            val values = ContentValues().apply {
                put("id", id)
                put("text", text)
                put("normalizedText", text.trim().lowercase())
                put("definition", "Definition of $text")
                put("example", "Example of $text")
                put("partOfSpeech", partOfSpeech)
                put("createdAt", createdAt)
                put("repetitions", repetitions)
                put("easeFactor", easeFactor)
                put("intervalDays", intervalDays)
                put("dueOn", dueOn)
                put("lapses", lapses)
                put("lastReviewedAt", lastReviewedAt)
                put("firstReviewedOn", firstReviewedOn)
                put("isNew", isNew)
                put("suspended", suspended)
            }
            db.insert("words", android.database.sqlite.SQLiteDatabase.CONFLICT_NONE, values)
        }

        fun log(id: Long, wordId: Long, reviewedAt: Long, reviewedOn: Long, grade: Int, correct: Int, typed: String) {
            val values = ContentValues().apply {
                put("id", id)
                put("wordId", wordId)
                put("reviewedAt", reviewedAt)
                put("reviewedOn", reviewedOn)
                put("grade", grade)
                put("correct", correct)
                put("typedAnswer", typed)
            }
            db.insert("review_log", android.database.sqlite.SQLiteDatabase.CONFLICT_NONE, values)
        }

        word(1, "tortoise", "noun", 1_000, 3, 2.36, 6, 20_000, 1, 5_000, 19_990, 0, 0)
        word(2, "shell", null, 2_000, 0, 2.5, 0, 20_001, 0, null, null, 1, 0)
        word(3, "Café", "noun", 3_000, 0, 2.5, 0, 20_002, 0, null, null, 1, 1)
        log(1, 1, 5_000, 19_990, 5, 1, "tortoise")
        log(2, 1, 6_000, 19_996, 2, 0, "tortoize")
        log(3, 3, 7_000, 19_996, 5, 1, "Café")
    }

    private fun createVersion1(): SupportSQLiteDatabase =
        helper.createDatabase(dbName, 1).also { seedVersion1(it) }

    @Test
    fun migration1To2KeepsEveryWordAndReview() {
        createVersion1().close()

        val db = helper.runMigrationsAndValidate(dbName, 2, true, MIGRATION_1_2)

        db.query("SELECT * FROM words ORDER BY id").use { c ->
            assertEquals(3, c.count)
            c.moveToFirst()
            assertEquals("tortoise", c.getString(c.getColumnIndexOrThrow("text")))
            assertEquals("tortoise", c.getString(c.getColumnIndexOrThrow("normalizedText")))
            assertEquals("Definition of tortoise", c.getString(c.getColumnIndexOrThrow("definition")))
            assertEquals("Example of tortoise", c.getString(c.getColumnIndexOrThrow("example")))
            assertEquals("noun", c.getString(c.getColumnIndexOrThrow("partOfSpeech")))
            assertEquals(1_000L, c.getLong(c.getColumnIndexOrThrow("createdAt")))
            assertEquals(3, c.getInt(c.getColumnIndexOrThrow("repetitions")))
            assertEquals(2.36, c.getDouble(c.getColumnIndexOrThrow("easeFactor")), 0.0)
            assertEquals(6, c.getInt(c.getColumnIndexOrThrow("intervalDays")))
            assertEquals(20_000L, c.getLong(c.getColumnIndexOrThrow("dueOn")))
            assertEquals(1, c.getInt(c.getColumnIndexOrThrow("lapses")))
            assertEquals(5_000L, c.getLong(c.getColumnIndexOrThrow("lastReviewedAt")))
            assertEquals(19_990L, c.getLong(c.getColumnIndexOrThrow("firstReviewedOn")))
            assertEquals(0, c.getInt(c.getColumnIndexOrThrow("isNew")))
            assertEquals(0, c.getInt(c.getColumnIndexOrThrow("suspended")))
            assertEquals(0, c.getInt(c.getColumnIndexOrThrow("autoRefresh")))
            assertEquals(true, c.isNull(c.getColumnIndexOrThrow("refreshedOn")))

            c.moveToNext()
            assertEquals("shell", c.getString(c.getColumnIndexOrThrow("text")))
            assertEquals(true, c.isNull(c.getColumnIndexOrThrow("partOfSpeech")))
            assertEquals(2_000L, c.getLong(c.getColumnIndexOrThrow("createdAt")))
            assertEquals(0, c.getInt(c.getColumnIndexOrThrow("repetitions")))
            assertEquals(2.5, c.getDouble(c.getColumnIndexOrThrow("easeFactor")), 0.0)
            assertEquals(0, c.getInt(c.getColumnIndexOrThrow("intervalDays")))
            assertEquals(20_001L, c.getLong(c.getColumnIndexOrThrow("dueOn")))
            assertEquals(0, c.getInt(c.getColumnIndexOrThrow("lapses")))
            assertEquals(true, c.isNull(c.getColumnIndexOrThrow("lastReviewedAt")))
            assertEquals(true, c.isNull(c.getColumnIndexOrThrow("firstReviewedOn")))
            assertEquals(1, c.getInt(c.getColumnIndexOrThrow("isNew")))
            assertEquals(0, c.getInt(c.getColumnIndexOrThrow("suspended")))
            assertEquals(0, c.getInt(c.getColumnIndexOrThrow("autoRefresh")))
            assertEquals(true, c.isNull(c.getColumnIndexOrThrow("refreshedOn")))

            c.moveToNext()
            assertEquals("Café", c.getString(c.getColumnIndexOrThrow("text")))
            assertEquals("café", c.getString(c.getColumnIndexOrThrow("normalizedText")))
            assertEquals("noun", c.getString(c.getColumnIndexOrThrow("partOfSpeech")))
            assertEquals(3_000L, c.getLong(c.getColumnIndexOrThrow("createdAt")))
            assertEquals(1, c.getInt(c.getColumnIndexOrThrow("isNew")))
            assertEquals(1, c.getInt(c.getColumnIndexOrThrow("suspended")))
            assertEquals(0, c.getInt(c.getColumnIndexOrThrow("autoRefresh")))
            assertEquals(true, c.isNull(c.getColumnIndexOrThrow("refreshedOn")))
        }

        db.query("SELECT * FROM review_log ORDER BY id").use { c ->
            assertEquals(3, c.count)
            val expected = listOf(
                listOf(1L, 1L, 5_000L, 19_990L, 5L, 1L, "tortoise"),
                listOf(2L, 1L, 6_000L, 19_996L, 2L, 0L, "tortoize"),
                listOf(3L, 3L, 7_000L, 19_996L, 5L, 1L, "Café"),
            )
            for (row in expected) {
                c.moveToNext()
                assertEquals(row[0], c.getLong(c.getColumnIndexOrThrow("id")))
                assertEquals(row[1], c.getLong(c.getColumnIndexOrThrow("wordId")))
                assertEquals(row[2], c.getLong(c.getColumnIndexOrThrow("reviewedAt")))
                assertEquals(row[3], c.getLong(c.getColumnIndexOrThrow("reviewedOn")))
                assertEquals(row[4], c.getLong(c.getColumnIndexOrThrow("grade")))
                assertEquals(row[5], c.getLong(c.getColumnIndexOrThrow("correct")))
                assertEquals(row[6], c.getString(c.getColumnIndexOrThrow("typedAnswer")))
            }
        }

        db.query("PRAGMA foreign_key_check").use { assertEquals(0, it.count) }
        db.close()
    }

    @Test
    fun roomReadsTheMigratedData() = runTest {
        createVersion1().close()
        helper.runMigrationsAndValidate(dbName, 2, true, MIGRATION_1_2).close()

        val room = Room.databaseBuilder(
            ApplicationProvider.getApplicationContext(),
            TortoiseSpellingDatabase::class.java,
            dbName,
        ).addMigrations(*ALL_MIGRATIONS).build()
        try {
            val dao = room.dao()
            val expected = listOf(
                Word(
                    id = 1, text = "tortoise", normalizedText = "tortoise",
                    definition = "Definition of tortoise", example = "Example of tortoise",
                    partOfSpeech = "noun", createdAt = 1_000, repetitions = 3, easeFactor = 2.36,
                    intervalDays = 6, dueOn = 20_000, lapses = 1, lastReviewedAt = 5_000,
                    firstReviewedOn = 19_990, isNew = false, suspended = false,
                    autoRefresh = false, refreshedOn = null,
                ),
                Word(
                    id = 2, text = "shell", normalizedText = "shell",
                    definition = "Definition of shell", example = "Example of shell",
                    partOfSpeech = null, createdAt = 2_000, dueOn = 20_001,
                ),
                Word(
                    id = 3, text = "Café", normalizedText = "café",
                    definition = "Definition of Café", example = "Example of Café",
                    partOfSpeech = "noun", createdAt = 3_000, dueOn = 20_002, suspended = true,
                ),
            )
            assertEquals(expected, dao.allWordsOnce())
            assertEquals(listOf(1L), dao.dueWords(today = 20_000).map { it.id })
            assertEquals(listOf(2L), dao.newWords(limit = 10).map { it.id })
        } finally {
            room.close()
        }
    }

    @Test
    fun everyMigrationRunsFromVersion1() {
        createVersion1().close()

        val db = helper.runMigrationsAndValidate(dbName, DATABASE_VERSION, true, *ALL_MIGRATIONS)

        db.query("SELECT COUNT(*) FROM words").use {
            it.moveToFirst()
            assertEquals(3, it.getInt(0))
        }
        db.query("SELECT COUNT(*) FROM review_log").use {
            it.moveToFirst()
            assertEquals(3, it.getInt(0))
        }
        db.close()
    }
}
