package io.github.dontpanic345.tortoisespelling.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WordContentTest {

    private fun run() = WordContent(
        listOf(
            DefinitionDraft(
                text = "To move fast on foot.",
                partOfSpeech = "verb",
                forms = listOf(
                    FormDraft("run", examples = listOf(ExampleDraft("I run daily."))),
                    FormDraft("ran", label = "past tense", examples = listOf(ExampleDraft("He ran home."))),
                ),
            ),
            DefinitionDraft(
                text = "An enclosed pen.",
                partOfSpeech = "noun",
                forms = listOf(FormDraft("run", examples = listOf(ExampleDraft("A chicken run.")))),
            ),
        ),
    )

    // --- simpleContent ---

    @Test
    fun `simple content is one definition, the base form and the example`() {
        val content = simpleContent("rhythm", "A pattern.", "noun", "The rhythm held.")
        assertEquals(
            WordContent(
                listOf(
                    DefinitionDraft(
                        "A pattern.",
                        "noun",
                        listOf(FormDraft("rhythm", examples = listOf(ExampleDraft("The rhythm held.")))),
                    ),
                ),
            ),
            content,
        )
    }

    @Test
    fun `simple content keeps no example when it is blank`() {
        val content = simpleContent("rhythm", "A pattern.", null, "  ")
        assertTrue(content.definitions.single().forms.single().examples.isEmpty())
        assertEquals("", content.definitions.single().partOfSpeech)
    }

    // --- preparedFor ---

    @Test
    fun `preparing trims every field and drops blank examples`() {
        val prepared = WordContent(
            listOf(
                DefinitionDraft(
                    " A pattern. ",
                    " noun ",
                    listOf(
                        FormDraft(
                            "x",
                            " plural ",
                            listOf(ExampleDraft("  The rhythm held. ", shownAt = 5), ExampleDraft("   ")),
                        ),
                    ),
                ),
            ),
        ).preparedFor(" rhythm ")

        val definition = prepared.definitions.single()
        assertEquals("A pattern.", definition.text)
        assertEquals("noun", definition.partOfSpeech)
        val form = definition.forms.single()
        assertEquals("rhythm", form.text)
        assertEquals("plural", form.label)
        assertEquals(listOf(ExampleDraft("The rhythm held.", shownAt = 5)), form.examples)
    }

    @Test
    fun `preparing sets the base form to the word`() {
        val prepared = run().preparedFor("run").definitions[0].forms
        assertEquals(listOf("run", "ran"), prepared.map { it.text })
        assertEquals("walk", run().preparedFor("walk").definitions[0].forms[0].text)
    }

    @Test
    fun `preparing gives the first definition a base form when it has none`() {
        val prepared = WordContent(listOf(DefinitionDraft("A pattern.", forms = emptyList()))).preparedFor("rhythm")
        assertEquals(listOf(FormDraft("rhythm")), prepared.definitions.single().forms)
    }

    @Test
    fun `preparing gives empty content a first definition and base form`() {
        val prepared = WordContent(emptyList()).preparedFor("rhythm")
        assertEquals(DefinitionDraft("", "", listOf(FormDraft("rhythm"))), prepared.definitions.single())
    }

    @Test
    fun `preparing drops empty forms but never the base form`() {
        val prepared = WordContent(
            listOf(
                DefinitionDraft(
                    "A pattern.",
                    forms = listOf(
                        FormDraft("", examples = listOf(ExampleDraft(""))),
                        FormDraft("  ", examples = listOf(ExampleDraft(""))),
                        FormDraft("rhythms"),
                        FormDraft("", examples = listOf(ExampleDraft("A sentence."))),
                    ),
                ),
            ),
        ).preparedFor("rhythm")

        assertEquals(listOf("rhythm", "rhythms", ""), prepared.definitions.single().forms.map { it.text })
    }

    @Test
    fun `preparing drops later definitions that are empty`() {
        val prepared = WordContent.blank()
            .apply(ContentEdit.DefinitionText(0, "A pattern."))
            .apply(ContentEdit.AddDefinition)
            .preparedFor("rhythm")
        assertEquals(1, prepared.definitions.size)
    }

    @Test
    fun `preparing keeps a later definition that has text or a form`() {
        val withText = WordContent.blank().apply(ContentEdit.AddDefinition)
            .apply(ContentEdit.DefinitionText(1, "Another sense."))
        assertEquals(2, withText.preparedFor("rhythm").definitions.size)

        val withForm = WordContent.blank().apply(ContentEdit.AddDefinition)
            .apply(ContentEdit.FormText(1, 0, "rhythms"))
        assertEquals(2, withForm.preparedFor("rhythm").definitions.size)
    }

    @Test
    fun `preparing blanks every form out of every definition`() {
        val prepared = WordContent(
            listOf(
                DefinitionDraft(
                    "To practise; to ran through. Practice makes perfect.",
                    forms = listOf(FormDraft("practice"), FormDraft("practise"), FormDraft("ran")),
                ),
                DefinitionDraft("Past of run: ran fast.", forms = listOf(FormDraft("ran"))),
            ),
        ).preparedFor("practice")

        assertEquals("To _____; to _____ through. _____ makes perfect.", prepared.definitions[0].text)
        assertEquals("Past of run: _____ fast.", prepared.definitions[1].text)
    }

    @Test
    fun `preparing keeps shownAt`() {
        val prepared = WordContent(
            listOf(
                DefinitionDraft(
                    "A pattern.",
                    forms = listOf(FormDraft("rhythm", examples = listOf(ExampleDraft("Rhythm.", shownAt = 99)))),
                ),
            ),
        ).preparedFor("rhythm")
        assertEquals(99L, prepared.definitions.single().forms.single().examples.single().shownAt)
    }

    // --- isComplete ---

    @Test
    fun `content is complete with a first definition`() {
        assertTrue(WordContent.blank().apply(ContentEdit.DefinitionText(0, "A pattern.")).isComplete())
    }

    @Test
    fun `a blank first definition is incomplete`() {
        assertFalse(WordContent.blank().isComplete())
        assertFalse(WordContent(emptyList()).isComplete())
    }

    @Test
    fun `an empty second definition does not block saving`() {
        val content = WordContent.blank()
            .apply(ContentEdit.DefinitionText(0, "A pattern."))
            .apply(ContentEdit.AddDefinition)
        assertTrue(content.isComplete())
    }

    @Test
    fun `a second definition with content but no text blocks saving`() {
        val content = WordContent.blank()
            .apply(ContentEdit.DefinitionText(0, "A pattern."))
            .apply(ContentEdit.AddDefinition)
            .apply(ContentEdit.ExampleText(1, 0, 0, "A sentence."))
        assertFalse(content.isComplete())
    }

    @Test
    fun `a form with an example but no spelling blocks saving`() {
        val content = WordContent.blank()
            .apply(ContentEdit.DefinitionText(0, "A pattern."))
            .apply(ContentEdit.AddForm(0))
            .apply(ContentEdit.ExampleText(0, 1, 0, "A sentence."))
        assertFalse(content.isComplete())
    }

    @Test
    fun `a blank extra form does not block saving`() {
        val content = WordContent.blank()
            .apply(ContentEdit.DefinitionText(0, "A pattern."))
            .apply(ContentEdit.AddForm(0))
        assertTrue(content.isComplete())
    }

    // --- apply ---

    @Test
    fun `text edits change one field`() {
        val edited = run()
            .apply(ContentEdit.DefinitionText(1, "A pen."))
            .apply(ContentEdit.PartOfSpeech(0, "intransitive verb"))
            .apply(ContentEdit.FormText(0, 1, "runs"))
            .apply(ContentEdit.FormLabel(0, 1, "third person"))
            .apply(ContentEdit.ExampleText(0, 1, 0, "She runs home."))

        assertEquals("A pen.", edited.definitions[1].text)
        assertEquals("intransitive verb", edited.definitions[0].partOfSpeech)
        assertEquals("runs", edited.definitions[0].forms[1].text)
        assertEquals("third person", edited.definitions[0].forms[1].label)
        assertEquals("She runs home.", edited.definitions[0].forms[1].examples[0].text)
        assertEquals(run().definitions[0].forms[0], edited.definitions[0].forms[0])
    }

    @Test
    fun `adding a definition adds a blank form with one blank example`() {
        val added = run().apply(ContentEdit.AddDefinition).definitions.last()
        assertEquals(DefinitionDraft("", "", listOf(FormDraft("", "", listOf(ExampleDraft(""))))), added)
    }

    @Test
    fun `adding a form or an example appends a blank one`() {
        val withForm = run().apply(ContentEdit.AddForm(1)).definitions[1].forms
        assertEquals(FormDraft("", "", listOf(ExampleDraft(""))), withForm.last())
        assertEquals(2, withForm.size)

        val withExample = run().apply(ContentEdit.AddExample(0, 0)).definitions[0].forms[0].examples
        assertEquals(listOf("I run daily.", ""), withExample.map { it.text })
    }

    @Test
    fun `removing takes out only what was asked`() {
        assertEquals(1, run().apply(ContentEdit.RemoveDefinition(1)).definitions.size)
        assertEquals(listOf("run"), run().apply(ContentEdit.RemoveForm(0, 1)).definitions[0].forms.map { it.text })
        assertTrue(run().apply(ContentEdit.RemoveExample(0, 1, 0)).definitions[0].forms[1].examples.isEmpty())
    }

    @Test
    fun `the first definition and the base form cannot be removed`() {
        assertEquals(run(), run().apply(ContentEdit.RemoveDefinition(0)))
        assertEquals(run(), run().apply(ContentEdit.RemoveForm(0, 0)))
    }

    @Test
    fun `another definition's first form can be removed`() {
        assertTrue(run().apply(ContentEdit.RemoveForm(1, 0)).definitions[1].forms.isEmpty())
    }

    @Test
    fun `an edit that points nowhere changes nothing`() {
        assertEquals(run(), run().apply(ContentEdit.FormText(5, 0, "x")))
        assertEquals(run(), run().apply(ContentEdit.ExampleText(0, 0, 9, "x")))
        assertEquals(run(), run().apply(ContentEdit.RemoveForm(0, 9)))
    }

    // --- search and the example warning ---

    @Test
    fun `search terms are the root and every form, normalized`() {
        val content = run().apply(ContentEdit.FormText(0, 1, "  Ran  "))
        assertEquals(setOf("run", "ran"), content.searchTerms("Run"))
    }

    @Test
    fun `search terms include the root when no form carries it`() {
        assertEquals(setOf("practice", "practise"), WordContent(
            listOf(DefinitionDraft("To do.", forms = listOf(FormDraft("practise")))),
        ).searchTerms("Practice"))
    }

    @Test
    fun `an example that lacks its form is flagged`() {
        assertTrue(exampleMissesForm("He ran home.", "run"))
        assertFalse(exampleMissesForm("He ran home.", "ran"))
        assertFalse(exampleMissesForm("  ", "run"))
    }
}
