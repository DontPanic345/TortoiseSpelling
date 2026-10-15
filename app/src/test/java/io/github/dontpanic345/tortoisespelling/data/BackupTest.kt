package io.github.dontpanic345.tortoisespelling.data

import io.github.dontpanic345.tortoisespelling.domain.simpleContent
import kotlinx.serialization.Serializable
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class BackupTest {

    private val word = Word(
        id = 7,
        text = "Accommodate",
        normalizedText = "accommodate",
        repetitions = 3,
        easeFactor = 2.36,
        intervalDays = 17,
        dueOn = 20_400,
        lapses = 1,
        firstReviewedOn = 20_380,
        isNew = false,
    )

    private val content = WordWithContent(
        word = word,
        definitions = listOf(
            DefinitionWithForms(
                Definition(id = 1, wordId = 7, text = "To provide room for.", partOfSpeech = "verb", orderIndex = 0),
                listOf(
                    FormWithExamples(
                        WordForm(id = 1, definitionId = 1, text = "Accommodate", orderIndex = 0),
                        listOf(
                            ExampleSentence(id = 1, wordFormId = 1, text = "The hall can hold two hundred.", orderIndex = 0),
                            ExampleSentence(id = 2, wordFormId = 1, text = "We can accommodate you.", orderIndex = 1),
                        ),
                    ),
                ),
            ),
        ),
    )

    @Test
    fun `a word survives a round trip with its scheduling and content intact`() {
        val json = BackupJson.encodeToString(
            BackupFile.serializer(),
            BackupFile(words = listOf(content.toBackup())),
        )
        val imported = parseBackup(json).words.single().toImport()
        val restored = imported.word

        assertEquals(word.text, restored.text)
        assertEquals(content.toContent(), imported.content)
        assertEquals(word.repetitions, restored.repetitions)
        assertEquals(word.easeFactor, restored.easeFactor, 1e-9)
        assertEquals(word.intervalDays, restored.intervalDays)
        assertEquals(word.dueOn, restored.dueOn)
        assertEquals(word.lapses, restored.lapses)
        assertEquals(word.firstReviewedOn, restored.firstReviewedOn)
        assertEquals(word.isNew, restored.isNew)
    }

    @Test
    fun `a backup from when cards could be kept fresh still imports, the two keys ignored`() {
        val imported = parseBackup(
            """
            {"version":1,"exportedAt":1,"words":[
              {"text":"rhythm","definition":"A pattern of sound.","dueOn":20400,
               "autoRefresh":true,"refreshedOn":20000}
            ]}
            """.trimIndent(),
        ).words.single().toImport()

        assertEquals("rhythm", imported.word.text)
        assertEquals(20_400L, imported.word.dueOn)
        assertEquals(simpleContent("rhythm", "A pattern of sound.", null, ""), imported.content)
    }

    @Test
    fun `an export has no autoRefresh or refreshedOn key`() {
        val json = BackupJson.encodeToString(
            BackupFile.serializer(),
            BackupFile(words = listOf(content.toBackup())),
        )
        assertFalse(json.contains("autoRefresh"))
        assertFalse(json.contains("refreshedOn"))
    }

    @Test
    fun `normalized text is rebuilt on import rather than trusted`() {
        val restored = BackupWord(text = "  Paris  ", definition = "A capital.", dueOn = 1).toImport().word
        assertEquals("Paris", restored.text)
        assertEquals("paris", restored.normalizedText)
    }

    @Test
    fun `the export carries a version`() {
        val json = BackupJson.encodeToString(BackupFile.serializer(), BackupFile(words = emptyList()))
        assertTrue(json.contains("\"version\""))
        assertEquals(BackupFile.CURRENT_VERSION, parseBackup(json).version)
    }

    @Test
    fun `a backup from a newer version is refused rather than half-read`() {
        val json = """{"version":99,"exportedAt":0,"words":[]}"""
        val error = assertThrows(BackupFormatException::class.java) { parseBackup(json) }
        assertTrue(error.message.orEmpty().contains("newer version"))
    }

    @Test
    fun `unknown fields from a future version are ignored`() {
        val json = """
            {"version":1,"exportedAt":0,"words":[
              {"text":"cat","definition":"A small animal.","dueOn":5,"somethingNew":true}
            ]}
        """.trimIndent()
        assertEquals("cat", parseBackup(json).words.single().text)
    }

    @Test
    fun `a file that is not a backup is rejected clearly`() {
        val error = assertThrows(BackupFormatException::class.java) { parseBackup("not json") }
        assertTrue(error.message.orEmpty().contains("isn't a Tortoise Spelling backup"))
    }

    @Test
    fun `optional fields fall back to sensible defaults`() {
        val json = """{"version":1,"words":[{"text":"cat","definition":"An animal.","dueOn":3}]}"""
        val imported = parseBackup(json).words.single().toImport()
        val restored = imported.word
        assertEquals(simpleContent("cat", "An animal.", null, ""), imported.content)
        assertEquals(2.5, restored.easeFactor, 1e-9)
        assertTrue(restored.isNew)
    }

    private val tree = WordWithContent(
        word = word,
        definitions = listOf(
            DefinitionWithForms(
                Definition(id = 2, wordId = 7, text = "An enclosed pen.", partOfSpeech = "noun", orderIndex = 1),
                listOf(
                    FormWithExamples(
                        WordForm(id = 4, definitionId = 2, text = "Runs", label = "plural", orderIndex = 0),
                        listOf(ExampleSentence(id = 6, wordFormId = 4, text = "Two runs.", orderIndex = 0)),
                    ),
                ),
            ),
            DefinitionWithForms(
                Definition(id = 1, wordId = 7, text = "To move fast.", partOfSpeech = "verb", orderIndex = 0),
                listOf(
                    FormWithExamples(
                        WordForm(id = 3, definitionId = 1, text = "ran", label = "past tense", orderIndex = 1),
                        listOf(ExampleSentence(id = 5, wordFormId = 3, text = "He ran home.", shownAt = 99, orderIndex = 0)),
                    ),
                    FormWithExamples(
                        WordForm(id = 2, definitionId = 1, text = "run", orderIndex = 0),
                        listOf(
                            ExampleSentence(id = 8, wordFormId = 2, text = "Second.", orderIndex = 1),
                            ExampleSentence(id = 7, wordFormId = 2, text = "I run daily.", shownAt = 5, orderIndex = 0),
                        ),
                    ),
                ),
            ),
        ),
    )

    private fun roundTrip(backup: BackupWord): BackupWord = parseBackup(
        BackupJson.encodeToString(BackupFile.serializer(), BackupFile(words = listOf(backup))),
    ).words.single()

    @Test
    fun `a content tree round trips with order, labels, parts of speech and shownAt`() {
        val imported = roundTrip(tree.toBackup()).toImport()
        assertEquals(tree.toContent(), imported.content)
        assertEquals(2, imported.content.definitions.size)
        assertEquals(
            listOf("I run daily.", "Second."),
            imported.content.definitions[0].forms[0].examples.map { it.text },
        )
        assertEquals(5L, imported.content.definitions[0].forms[0].examples[0].shownAt)
        assertEquals("past tense", imported.content.definitions[0].forms[1].label)
    }

    @Test
    fun `the flat fields mirror the root card`() {
        val flat = tree.toBackup()
        assertEquals("To move fast.", flat.definition)
        assertEquals("verb", flat.partOfSpeech)
        assertEquals("I run daily.", flat.example)
    }

    @Test
    fun `a file with no definitions imports as simple content`() {
        val flat = BackupWord(text = "cat", definition = "An animal.", example = "A cat sat.", dueOn = 1)
        assertEquals(
            simpleContent("cat", "An animal.", null, "A cat sat."),
            roundTrip(flat).toImport().content,
        )
    }

    @Serializable
    private data class OlderBackupWord(
        val text: String,
        val definition: String,
        val example: String = "",
        val partOfSpeech: String? = null,
        val dueOn: Long,
        val autoRefresh: Boolean = false,
        val refreshedOn: Long? = null,
    )

    @Serializable
    private data class OlderBackupFile(val version: Int, val words: List<OlderBackupWord>)

    @Test
    fun `a tree file still reads as the root card in a build without definitions`() {
        val json = BackupJson.encodeToString(BackupFile.serializer(), BackupFile(words = listOf(tree.toBackup())))
        val older = BackupJson.decodeFromString(OlderBackupFile.serializer(), json).words.single()
        assertEquals("To move fast.", older.definition)
        assertEquals("I run daily.", older.example)
        assertEquals("verb", older.partOfSpeech)
    }

    @Test
    fun `a file written now reads in a build that still had the refresh fields as their defaults`() {
        val json = BackupJson.encodeToString(BackupFile.serializer(), BackupFile(words = listOf(tree.toBackup())))
        val older = BackupJson.decodeFromString(OlderBackupFile.serializer(), json).words.single()
        assertFalse(older.autoRefresh)
        assertNull(older.refreshedOn)
    }
}
