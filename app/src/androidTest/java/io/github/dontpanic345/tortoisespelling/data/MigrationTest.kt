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
import io.github.dontpanic345.tortoisespelling.data.TortoiseSpellingDatabase.Companion.MIGRATION_2_3
import io.github.dontpanic345.tortoisespelling.data.TortoiseSpellingDatabase.Companion.MIGRATION_3_4
import io.github.dontpanic345.tortoisespelling.domain.DefinitionDraft
import io.github.dontpanic345.tortoisespelling.domain.ExampleDraft
import io.github.dontpanic345.tortoisespelling.domain.FormDraft
import io.github.dontpanic345.tortoisespelling.domain.WordContent
import io.github.dontpanic345.tortoisespelling.domain.simpleContent
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
                    createdAt = 1_000, repetitions = 3, easeFactor = 2.36,
                    intervalDays = 6, dueOn = 20_000, lapses = 1, lastReviewedAt = 5_000,
                    firstReviewedOn = 19_990, isNew = false, suspended = false,
                ),
                Word(
                    id = 2, text = "shell", normalizedText = "shell",
                    createdAt = 2_000, dueOn = 20_001,
                ),
                Word(
                    id = 3, text = "Café", normalizedText = "café",
                    createdAt = 3_000, dueOn = 20_002, suspended = true,
                ),
            )
            assertEquals(expected, dao.allWordsOnce())
            assertEquals(listOf(1L), dao.dueWords(today = 20_000).map { it.id })
            assertEquals(listOf(2L), dao.newWords(limit = 10).map { it.id })

            val content = dao.contentById(1)!!.toContent()
            assertEquals(
                simpleContent("tortoise", "Definition of tortoise", "noun", "Example of tortoise"),
                content,
            )
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

    private fun createVersion2(): SupportSQLiteDatabase =
        helper.createDatabase(dbName, 2).also { seedVersion2(it) }

    private fun seedVersion2(db: SupportSQLiteDatabase) {
        fun word(
            id: Long,
            text: String,
            example: String,
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
            autoRefresh: Int,
            refreshedOn: Long?,
        ) {
            val values = ContentValues().apply {
                put("id", id)
                put("text", text)
                put("normalizedText", text.trim().lowercase())
                put("definition", "Definition of $text")
                put("example", example)
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
                put("autoRefresh", autoRefresh)
                put("refreshedOn", refreshedOn)
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

        word(1, "tortoise", "Example of tortoise", "noun", 1_000, 3, 2.36, 6, 20_000, 1, 5_000, 19_990, 0, 0, 1, 19_999)
        word(2, "shell", "  ", null, 2_000, 0, 2.5, 0, 20_001, 0, null, null, 1, 0, 0, null)
        word(3, "Café", "Example of Café", "noun", 3_000, 0, 2.5, 0, 20_002, 0, null, null, 1, 1, 0, null)
        word(4, "carapace", "Example of carapace", "", 4_000, 0, 2.5, 0, 20_003, 0, null, null, 1, 0, 0, null)
        log(1, 1, 5_000, 19_990, 5, 1, "tortoise")
        log(2, 1, 6_000, 19_996, 2, 0, "tortoize")
        log(3, 3, 7_000, 19_996, 5, 1, "Café")
    }

    private fun SupportSQLiteDatabase.rows(sql: String): List<List<Any?>> = query(sql).use { c ->
        buildList {
            while (c.moveToNext()) {
                add(
                    (0 until c.columnCount).map { column ->
                        when (c.getType(column)) {
                            android.database.Cursor.FIELD_TYPE_NULL -> null
                            android.database.Cursor.FIELD_TYPE_INTEGER -> c.getLong(column)
                            android.database.Cursor.FIELD_TYPE_FLOAT -> c.getDouble(column)
                            else -> c.getString(column)
                        }
                    },
                )
            }
        }
    }

    @Test
    fun migration2To3SplitsEachWordIntoADefinitionABaseFormAndAnExample() {
        createVersion2().close()

        val db = helper.runMigrationsAndValidate(dbName, 3, true, MIGRATION_2_3)

        assertEquals(
            listOf(
                listOf(1L, "tortoise", "tortoise", 1_000L, 3L, 2.36, 6L, 20_000L, 1L, 5_000L, 19_990L, 0L, 0L, 1L, 19_999L),
                listOf(2L, "shell", "shell", 2_000L, 0L, 2.5, 0L, 20_001L, 0L, null, null, 1L, 0L, 0L, null),
                listOf(3L, "Café", "café", 3_000L, 0L, 2.5, 0L, 20_002L, 0L, null, null, 1L, 1L, 0L, null),
                listOf(4L, "carapace", "carapace", 4_000L, 0L, 2.5, 0L, 20_003L, 0L, null, null, 1L, 0L, 0L, null),
            ),
            db.rows(
                "SELECT id, text, normalizedText, createdAt, repetitions, easeFactor, intervalDays, dueOn, " +
                    "lapses, lastReviewedAt, firstReviewedOn, isNew, suspended, autoRefresh, refreshedOn " +
                    "FROM words ORDER BY id",
            ),
        )
        assertEquals(
            listOf(
                listOf(1L, 1L, "Definition of tortoise", "noun", 0L),
                listOf(2L, 2L, "Definition of shell", null, 0L),
                listOf(3L, 3L, "Definition of Café", "noun", 0L),
                listOf(4L, 4L, "Definition of carapace", null, 0L),
            ),
            db.rows("SELECT id, wordId, text, partOfSpeech, orderIndex FROM definitions ORDER BY id"),
        )
        assertEquals(
            listOf(
                listOf(1L, 1L, "tortoise", null, 0L),
                listOf(2L, 2L, "shell", null, 0L),
                listOf(3L, 3L, "Café", null, 0L),
                listOf(4L, 4L, "carapace", null, 0L),
            ),
            db.rows("SELECT id, definitionId, text, label, orderIndex FROM word_forms ORDER BY id"),
        )
        assertEquals(
            listOf(
                listOf(1L, 1L, "Example of tortoise", 0L, null),
                listOf(3L, 3L, "Example of Café", 0L, null),
                listOf(4L, 4L, "Example of carapace", 0L, null),
            ),
            db.rows("SELECT id, wordFormId, text, orderIndex, shownAt FROM example_sentences ORDER BY id"),
        )
        assertEquals(
            listOf(
                listOf(1L, 1L, 5_000L, 19_990L, 5L, 1L, "tortoise"),
                listOf(2L, 1L, 6_000L, 19_996L, 2L, 0L, "tortoize"),
                listOf(3L, 3L, 7_000L, 19_996L, 5L, 1L, "Café"),
            ),
            db.rows("SELECT id, wordId, reviewedAt, reviewedOn, grade, correct, typedAnswer FROM review_log ORDER BY id"),
        )
        assertEquals(emptyList<List<Any?>>(), db.rows("PRAGMA foreign_key_check"))
        db.close()
    }

    @Test
    fun roomMigratesAVersion2DatabaseWithoutLosingAReview() = runTest {
        createVersion2().close()

        val room = Room.databaseBuilder(
            ApplicationProvider.getApplicationContext(),
            TortoiseSpellingDatabase::class.java,
            dbName,
        ).addMigrations(*ALL_MIGRATIONS).build()
        try {
            val dao = room.dao()
            assertEquals(4, dao.wordCount())
            room.openHelper.readableDatabase.query("SELECT COUNT(*) FROM review_log").use {
                it.moveToFirst()
                assertEquals(3, it.getInt(0))
            }
            assertEquals(1, dao.reviewedCountOn(19_990))
            val expected = mapOf(
                1L to simpleContent("tortoise", "Definition of tortoise", "noun", "Example of tortoise"),
                2L to simpleContent("shell", "Definition of shell", null, ""),
                3L to simpleContent("Café", "Definition of Café", "noun", "Example of Café"),
                4L to simpleContent("carapace", "Definition of carapace", null, "Example of carapace"),
            )
            for ((id, content) in expected) {
                assertEquals(content, dao.contentById(id)!!.toContent())
            }
        } finally {
            room.close()
        }
    }

    private fun createVersion3(): SupportSQLiteDatabase =
        helper.createDatabase(dbName, 3).also { seedVersion3(it) }

    private fun seedVersion3(db: SupportSQLiteDatabase) {
        fun insert(table: String, vararg columns: Pair<String, Any?>) {
            val values = ContentValues().apply {
                for ((name, value) in columns) {
                    when (value) {
                        null -> putNull(name)
                        is Int -> put(name, value)
                        is Long -> put(name, value)
                        is Double -> put(name, value)
                        else -> put(name, value as String)
                    }
                }
            }
            db.insert(table, android.database.sqlite.SQLiteDatabase.CONFLICT_NONE, values)
        }

        fun word(
            id: Long, text: String, createdAt: Long, repetitions: Int, easeFactor: Double, intervalDays: Int,
            dueOn: Long, lapses: Int, lastReviewedAt: Long?, firstReviewedOn: Long?, isNew: Int, suspended: Int,
            autoRefresh: Int, refreshedOn: Long?,
        ) = insert(
            "words",
            "id" to id, "text" to text, "normalizedText" to text.trim().lowercase(), "createdAt" to createdAt,
            "repetitions" to repetitions, "easeFactor" to easeFactor, "intervalDays" to intervalDays,
            "dueOn" to dueOn, "lapses" to lapses, "lastReviewedAt" to lastReviewedAt,
            "firstReviewedOn" to firstReviewedOn, "isNew" to isNew, "suspended" to suspended,
            "autoRefresh" to autoRefresh, "refreshedOn" to refreshedOn,
        )

        fun definition(id: Long, wordId: Long, text: String, partOfSpeech: String?, orderIndex: Int) = insert(
            "definitions",
            "id" to id, "wordId" to wordId, "text" to text, "partOfSpeech" to partOfSpeech,
            "orderIndex" to orderIndex,
        )

        fun form(id: Long, definitionId: Long, text: String, label: String?, orderIndex: Int) = insert(
            "word_forms",
            "id" to id, "definitionId" to definitionId, "text" to text, "label" to label,
            "orderIndex" to orderIndex,
        )

        fun example(id: Long, wordFormId: Long, text: String, orderIndex: Int, shownAt: Long?) = insert(
            "example_sentences",
            "id" to id, "wordFormId" to wordFormId, "text" to text, "orderIndex" to orderIndex,
            "shownAt" to shownAt,
        )

        fun log(id: Long, wordId: Long, reviewedAt: Long, reviewedOn: Long, grade: Int, correct: Int, typed: String) =
            insert(
                "review_log",
                "id" to id, "wordId" to wordId, "reviewedAt" to reviewedAt, "reviewedOn" to reviewedOn,
                "grade" to grade, "correct" to correct, "typedAnswer" to typed,
            )

        word(1, "tortoise", 1_000, 3, 2.36, 6, 20_000, 1, 5_000, 19_990, 0, 0, 1, 19_999)
        word(2, "shell", 2_000, 0, 2.5, 0, 20_001, 0, null, null, 1, 0, 0, null)
        word(3, "Café", 3_000, 0, 2.5, 0, 20_002, 0, null, null, 1, 1, 0, null)

        definition(1, 1, "Definition of tortoise", "noun", 0)
        definition(2, 2, "Definition of shell", null, 0)
        definition(3, 3, "Definition of Café", "noun", 0)
        definition(4, 1, "To move slowly", "verb", 1)

        form(1, 1, "tortoise", null, 0)
        form(2, 2, "shell", null, 0)
        form(3, 3, "Café", null, 0)
        form(4, 4, "tortoises", "plural", 0)

        example(1, 1, "Example of tortoise", 0, 123_456)
        example(2, 3, "Example of Café", 0, null)

        log(1, 1, 5_000, 19_990, 5, 1, "tortoise")
        log(2, 1, 6_000, 19_996, 2, 0, "tortoize")
        log(3, 3, 7_000, 19_996, 5, 1, "Café")
    }

    private val keptWordColumns =
        "id, text, normalizedText, createdAt, repetitions, easeFactor, intervalDays, dueOn, lapses, " +
            "lastReviewedAt, firstReviewedOn, isNew, suspended"

    @Test
    fun migration3To4DropsTheRefreshColumnsAndKeepsEverythingElse() {
        val before = createVersion3()
        val words = before.rows("SELECT $keptWordColumns FROM words ORDER BY id")
        val definitions = before.rows("SELECT * FROM definitions ORDER BY id")
        val forms = before.rows("SELECT * FROM word_forms ORDER BY id")
        val examples = before.rows("SELECT * FROM example_sentences ORDER BY id")
        val logs = before.rows("SELECT * FROM review_log ORDER BY id")
        before.close()

        val db = helper.runMigrationsAndValidate(dbName, 4, true, MIGRATION_3_4)

        assertEquals(
            listOf(
                listOf(1L, "tortoise", "tortoise", 1_000L, 3L, 2.36, 6L, 20_000L, 1L, 5_000L, 19_990L, 0L, 0L),
                listOf(2L, "shell", "shell", 2_000L, 0L, 2.5, 0L, 20_001L, 0L, null, null, 1L, 0L),
                listOf(3L, "Café", "café", 3_000L, 0L, 2.5, 0L, 20_002L, 0L, null, null, 1L, 1L),
            ),
            words,
        )
        assertEquals(words, db.rows("SELECT $keptWordColumns FROM words ORDER BY id"))
        val columns = db.rows("PRAGMA table_info(words)").map { it[1] }
        assertEquals(false, "autoRefresh" in columns)
        assertEquals(false, "refreshedOn" in columns)
        assertEquals(13, columns.size)
        assertEquals(definitions, db.rows("SELECT * FROM definitions ORDER BY id"))
        assertEquals(forms, db.rows("SELECT * FROM word_forms ORDER BY id"))
        assertEquals(examples, db.rows("SELECT * FROM example_sentences ORDER BY id"))
        assertEquals(logs, db.rows("SELECT * FROM review_log ORDER BY id"))
        assertEquals(3, logs.size)
        assertEquals(4, definitions.size)
        assertEquals(emptyList<List<Any?>>(), db.rows("PRAGMA foreign_key_check"))
        db.close()
    }

    @Test
    fun roomMigratesAVersion3DatabaseWithoutLosingAReviewOrASentence() = runTest {
        createVersion3().close()

        val room = Room.databaseBuilder(
            ApplicationProvider.getApplicationContext(),
            TortoiseSpellingDatabase::class.java,
            dbName,
        ).addMigrations(*ALL_MIGRATIONS).build()
        try {
            val dao = room.dao()
            assertEquals(3, dao.wordCount())
            val sqlite = room.openHelper.readableDatabase
            fun count(table: String) = sqlite.query("SELECT COUNT(*) FROM $table").use {
                it.moveToFirst()
                it.getInt(0)
            }
            assertEquals(3, count("review_log"))
            assertEquals(4, count("definitions"))
            assertEquals(4, count("word_forms"))
            assertEquals(2, count("example_sentences"))
            assertEquals(1, dao.reviewedCountOn(19_990))

            val tortoise = WordContent(
                listOf(
                    DefinitionDraft(
                        "Definition of tortoise", "noun",
                        listOf(FormDraft("tortoise", "", listOf(ExampleDraft("Example of tortoise", 123_456)))),
                    ),
                    DefinitionDraft("To move slowly", "verb", listOf(FormDraft("tortoises", "plural"))),
                ),
            )
            assertEquals(tortoise, dao.contentById(1)!!.toContent())
            assertEquals(simpleContent("shell", "Definition of shell", null, ""), dao.contentById(2)!!.toContent())
            assertEquals(
                simpleContent("Café", "Definition of Café", "noun", "Example of Café"),
                dao.contentById(3)!!.toContent(),
            )
            assertEquals(
                Word(
                    id = 1, text = "tortoise", normalizedText = "tortoise",
                    createdAt = 1_000, repetitions = 3, easeFactor = 2.36,
                    intervalDays = 6, dueOn = 20_000, lapses = 1, lastReviewedAt = 5_000,
                    firstReviewedOn = 19_990, isNew = false, suspended = false,
                ),
                dao.wordById(1),
            )
        } finally {
            room.close()
        }
    }
}
