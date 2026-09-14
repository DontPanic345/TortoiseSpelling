package io.github.dontpanic345.tortoisespelling.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class BackupTest {

    private val word = Word(
        id = 7,
        text = "Accommodate",
        normalizedText = "accommodate",
        definition = "To provide room for.",
        example = "The hall can hold two hundred.",
        partOfSpeech = "verb",
        repetitions = 3,
        easeFactor = 2.36,
        intervalDays = 17,
        dueOn = 20_400,
        lapses = 1,
        firstReviewedOn = 20_380,
        isNew = false,
    )

    @Test
    fun `a word survives a round trip with its scheduling intact`() {
        val json = BackupJson.encodeToString(
            BackupFile.serializer(),
            BackupFile(words = listOf(word.toBackup())),
        )
        val restored = parseBackup(json).words.single().toWord()

        assertEquals(word.text, restored.text)
        assertEquals(word.definition, restored.definition)
        assertEquals(word.partOfSpeech, restored.partOfSpeech)
        assertEquals(word.repetitions, restored.repetitions)
        assertEquals(word.easeFactor, restored.easeFactor, 1e-9)
        assertEquals(word.intervalDays, restored.intervalDays)
        assertEquals(word.dueOn, restored.dueOn)
        assertEquals(word.lapses, restored.lapses)
        assertEquals(word.firstReviewedOn, restored.firstReviewedOn)
        assertEquals(word.isNew, restored.isNew)
    }

    @Test
    fun `normalized text is rebuilt on import rather than trusted`() {
        val restored = BackupWord(text = "  Paris  ", definition = "A capital.", dueOn = 1).toWord()
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
        val restored = parseBackup(json).words.single().toWord()
        assertEquals("", restored.example)
        assertEquals(2.5, restored.easeFactor, 1e-9)
        assertTrue(restored.isNew)
    }
}
