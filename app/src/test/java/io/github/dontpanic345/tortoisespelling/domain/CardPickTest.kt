package io.github.dontpanic345.tortoisespelling.domain

import io.github.dontpanic345.tortoisespelling.data.Definition
import io.github.dontpanic345.tortoisespelling.data.DefinitionWithForms
import io.github.dontpanic345.tortoisespelling.data.ExampleSentence
import io.github.dontpanic345.tortoisespelling.data.FormWithExamples
import io.github.dontpanic345.tortoisespelling.data.Word
import io.github.dontpanic345.tortoisespelling.data.WordForm
import io.github.dontpanic345.tortoisespelling.data.WordWithContent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

class CardPickTest {
    private val word = Word(id = 1, text = "run", normalizedText = "run", dueOn = 0)

    private var nextId = 1L

    /** A form with one example per entry of [shown]; `null` is never shown. */
    private fun form(text: String, label: String? = null, vararg shown: Long?) = FormWithExamples(
        WordForm(id = nextId++, definitionId = 1, text = text, label = label, orderIndex = 0),
        shown.mapIndexed { i, at ->
            ExampleSentence(id = nextId++, wordFormId = 1, text = "$text $i", orderIndex = i, shownAt = at)
        },
    )

    private fun definition(text: String, order: Int, vararg forms: FormWithExamples) = DefinitionWithForms(
        Definition(id = nextId++, wordId = 1, text = text, partOfSpeech = "verb", orderIndex = order),
        forms.mapIndexed { i, f -> f.copy(form = f.form.copy(orderIndex = i)) },
    )

    private fun content(vararg definitions: DefinitionWithForms) = WordWithContent(word, definitions.toList())

    @Test
    fun `never shown beats shown`() {
        val card = pickCard(content(definition("d", 0, form("run", null, 5L, null))))
        assertEquals("run 1", card.example?.text)
    }

    @Test
    fun `the oldest shownAt wins across forms and definitions`() {
        val c = content(
            definition("first", 0, form("run", null, 30L), form("ran", "past", 20L)),
            definition("second", 1, form("running", null, 10L)),
        )
        val card = pickCard(c)
        assertEquals("running", card.form)
        assertEquals("second", card.definition)
    }

    @Test
    fun `ties go to random and both tied candidates come up`() {
        val c = content(definition("d", 0, form("run", null, 1L), form("ran", "past", 1L)))
        val forms = (0 until 40).map { pickCard(c, Random(it)).form }.toSet()
        assertEquals(setOf("run", "ran"), forms)
    }

    @Test
    fun `a form without examples is never picked while another has one`() {
        val c = content(definition("d", 0, form("run", null), form("ran", "past", 5L)))
        repeat(20) { assertEquals("ran", pickCard(c, Random(it)).form) }
    }

    @Test
    fun `no examples asks for the base form with no sentence`() {
        val card = pickCard(content(definition("d", 0, form("run", null), form("ran", "past"))))
        assertEquals("run", card.form)
        assertEquals("d", card.definition)
        assertNull(card.example)
    }

    @Test
    fun `no content asks for the word text`() {
        val card = pickCard(content())
        assertEquals("run", card.form)
        assertEquals("", card.definition)
        assertNull(card.example)
    }

    @Test
    fun `answer normalizes the form`() {
        val card = pickCard(content(definition("d", 0, form(" Ran ", null, null))))
        assertEquals("ran", card.answer)
    }

    @Test
    fun `hint joins part of speech and label and skips blanks`() {
        fun card(partOfSpeech: String?, label: String?) =
            ReviewCard(word, "d", partOfSpeech, "ran", label, null)
        assertEquals("verb · past tense", card("verb", "past tense").hint)
        assertEquals("verb", card("verb", "  ").hint)
        assertEquals("past tense", card(" ", "past tense").hint)
        assertNull(card(null, null).hint)
        assertNull(card("", " ").hint)
        assertTrue(card("verb", null).hint == "verb")
    }
}
