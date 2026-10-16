package io.github.dontpanic345.tortoisespelling.golden

import io.github.dontpanic345.tortoisespelling.data.BackupFormatException
import io.github.dontpanic345.tortoisespelling.data.BackupJson
import io.github.dontpanic345.tortoisespelling.data.BackupWord
import io.github.dontpanic345.tortoisespelling.data.Definition
import io.github.dontpanic345.tortoisespelling.data.DefinitionWithForms
import io.github.dontpanic345.tortoisespelling.data.ExampleSentence
import io.github.dontpanic345.tortoisespelling.data.FormWithExamples
import io.github.dontpanic345.tortoisespelling.data.ImportedWord
import io.github.dontpanic345.tortoisespelling.data.Word
import io.github.dontpanic345.tortoisespelling.data.WordForm
import io.github.dontpanic345.tortoisespelling.data.WordWithContent
import io.github.dontpanic345.tortoisespelling.data.parseBackup
import io.github.dontpanic345.tortoisespelling.data.toBackup
import io.github.dontpanic345.tortoisespelling.data.toImport
import io.github.dontpanic345.tortoisespelling.domain.WordContent
import io.github.dontpanic345.tortoisespelling.domain.preparedFor
import io.github.dontpanic345.tortoisespelling.golden.Golden.contentFrom
import io.github.dontpanic345.tortoisespelling.golden.Golden.forEachCase
import java.io.File
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.fail
import org.junit.Test

class BackupGoldenTest {
    private val file = Golden.load("backup")

    @Test
    fun everyFunctionHasARunner() = Golden.assertFunctions(file, setOf("files", "refusals", "quirks"))

    @Test
    fun files() = forEachCase(file, "files") { c ->
        val ignoreCreatedAt = c.boolOrNull("ignoreCreatedAt") ?: false
        val parsed = parseBackup(Golden.backupFile(c.str("file")).readText())
        val imported = parsed.words.map { it.toImport() }
        val expectedImported = c.array("imported")
        assertEquals(expectedImported.size, imported.size)
        imported.zip(expectedImported).forEachIndexed { i, (actual, expected) ->
            val e = expected.jsonObject
            val w = e.getValue("word").jsonObject
            val word = Golden.wordFrom(w).copy(
                normalizedText = w.str("normalizedText"),
                createdAt = if (ignoreCreatedAt) actual.word.createdAt else w.long("createdAt"),
            )
            assertEquals("word $i", word, actual.word)
            assertEquals("content $i", contentFrom(e.getValue("content")), actual.content)
        }

        val exported = imported.map { BackupJson.encodeToJsonElement(BackupWord.serializer(), it.stored().toBackup()).jsonObject }
        val expectedExported = c.array("exported")
        assertEquals(expectedExported.size, exported.size)
        exported.zip(expectedExported).forEachIndexed { i, (actual, expected) ->
            val trimmed = if (ignoreCreatedAt) JsonObject(actual - "createdAt") else actual
            assertEquals("exported $i", expected.jsonObject, trimmed)
        }
    }

    @Test
    fun refusals() = forEachCase(file, "refusals") { c ->
        assertRefused(c.str("text"), c.str("error"))
    }

    @Test
    fun quirks() = forEachCase(file, "quirks") { c ->
        val error = c.strOrNull("error")
        if (error != null) {
            assertRefused(c.str("text"), error)
        } else {
            val words = parseBackup(c.str("text")).words
            val word = words.single()
            c.longOrNull("dueOn")?.let { assertEquals(it, word.dueOn) }
            c.boolOrNull("isNew")?.let { assertEquals(it, word.isNew) }
            c.doubleOrNull("easeFactor")?.let { assertEquals(it, word.easeFactor, 1e-9) }
        }
    }

    private fun assertRefused(text: String, message: String) {
        try {
            parseBackup(text)
            fail("accepted")
        } catch (e: BackupFormatException) {
            assertEquals(message, e.message)
        }
    }

    /** The word as Room loads it after an import: [preparedFor] content split into rows. */
    private fun ImportedWord.stored(): WordWithContent {
        val content: WordContent = content.preparedFor(word.text)
        return WordWithContent(
            word.copy(id = 1),
            content.definitions.mapIndexed { d, definition ->
                DefinitionWithForms(
                    Definition(wordId = 1, text = definition.text, partOfSpeech = definition.partOfSpeech.ifBlank { null }, orderIndex = d),
                    definition.forms.mapIndexed { f, form ->
                        FormWithExamples(
                            WordForm(definitionId = 1, text = form.text, label = form.label.ifBlank { null }, orderIndex = f),
                            form.examples.mapIndexed { e, example ->
                                ExampleSentence(wordFormId = 1, text = example.text, orderIndex = e, shownAt = example.shownAt)
                            },
                        )
                    },
                )
            },
        )
    }
}
