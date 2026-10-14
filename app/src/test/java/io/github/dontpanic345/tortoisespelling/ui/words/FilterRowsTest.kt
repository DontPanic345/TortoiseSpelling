package io.github.dontpanic345.tortoisespelling.ui.words

import io.github.dontpanic345.tortoisespelling.data.Definition
import io.github.dontpanic345.tortoisespelling.data.DefinitionWithForms
import io.github.dontpanic345.tortoisespelling.data.ExampleSentence
import io.github.dontpanic345.tortoisespelling.data.FormWithExamples
import io.github.dontpanic345.tortoisespelling.data.Word
import io.github.dontpanic345.tortoisespelling.data.WordForm
import io.github.dontpanic345.tortoisespelling.data.WordWithContent
import io.github.dontpanic345.tortoisespelling.domain.WordFilter
import org.junit.Assert.assertEquals
import org.junit.Test

class FilterRowsTest {

    private fun entry(id: Long, text: String, definition: String, vararg forms: String): WordWithContent {
        val spellings = listOf(text) + forms
        return WordWithContent(
            word = Word(id = id, text = text, normalizedText = text.lowercase(), dueOn = 100),
            definitions = listOf(
                DefinitionWithForms(
                    Definition(id = id, wordId = id, text = definition, orderIndex = 0),
                    spellings.mapIndexed { i, spelling ->
                        FormWithExamples(
                            WordForm(id = id * 10 + i, definitionId = id, text = spelling, orderIndex = i),
                            listOf(ExampleSentence(id = id * 10 + i, wordFormId = id * 10 + i, text = "Use $spelling.", orderIndex = 0)),
                        )
                    },
                ),
            ),
        )
    }

    private val words = listOf(
        entry(1, "practice", "To do repeatedly.", "practise"),
        entry(2, "run", "To move fast on foot.", "ran"),
        entry(3, "cat", "A small animal."),
    )

    private fun found(query: String) =
        filterRows(words, query, WordFilter.ALL, today = 100).map { it.word.text }

    @Test
    fun `a spelling variant finds its root`() {
        assertEquals(listOf("practice"), found("practise"))
    }

    @Test
    fun `an irregular form finds its root`() {
        assertEquals(listOf("run"), found("ran"))
    }

    @Test
    fun `a definition's text does not match`() {
        assertEquals(emptyList<String>(), found("animal"))
    }

    @Test
    fun `a blank query keeps every word`() {
        assertEquals(listOf("practice", "run", "cat"), found("  "))
    }

    @Test
    fun `the row carries the first definition`() {
        assertEquals("To move fast on foot.", filterRows(words, "ran", WordFilter.ALL, 100).single().definition)
    }
}
