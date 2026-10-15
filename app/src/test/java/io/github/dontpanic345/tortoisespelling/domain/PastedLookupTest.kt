package io.github.dontpanic345.tortoisespelling.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class PastedLookupTest {
    private fun valid(text: String, typed: String = "practice") =
        parsePastedLookup(text, typed) as PastedLookup.Valid

    private fun invalid(text: String, typed: String = "practice") =
        (parsePastedLookup(text, typed) as PastedLookup.Invalid).message

    private fun form(text: String, vararg examples: String, label: String = "") =
        """{"text": "$text", "label": "$label", "examples": [${examples.joinToString { "\"$it\"" }}]}"""

    private fun definition(text: String, vararg forms: String, pos: String = "noun") =
        """{"text": "$text", "partOfSpeech": "$pos", "forms": [${forms.joinToString()}]}"""

    private fun answer(word: String, vararg definitions: String) =
        """{"word": "$word", "definitions": [${definitions.joinToString()}]}"""

    private val simple = answer(
        "practice",
        definition("repeated exercise", form("practice", "I practice daily.")),
    )

    private fun docExample(): String {
        val doc = generateSequence(File("").absoluteFile) { it.parentFile }
            .map { File(it, "docs/copy-prompt-lookup.md") }
            .first { it.exists() }
            .readText()
        return doc.substringAfter("```json").substringBefore("```")
    }

    @Test
    fun `the docs example parses`() {
        val result = valid(docExample())
        assertEquals("practice", result.word)
        assertFalse(result.renames)
        val (noun, verb) = result.content.definitions
        assertEquals("repeated exercise to improve a skill", noun.text)
        assertEquals("noun", noun.partOfSpeech)
        assertEquals(listOf("practice", "practices"), noun.forms.map { it.text })
        assertEquals(listOf("singular", "plural"), noun.forms.map { it.label })
        assertEquals("verb", verb.partOfSpeech)
        assertEquals(listOf("practise", "practised"), verb.forms.map { it.text })
        assertEquals(listOf("base", "past tense"), verb.forms.map { it.label })
        assertEquals("He runs two medical practices.", noun.forms[1].examples.single().text)
        assertEquals("2 definitions, 4 forms, 4 example sentences", result.content.summary())
    }

    @Test
    fun `a fence and surrounding prose parse the same`() {
        val plain = valid(simple)
        assertEquals(plain, valid("```json\n$simple\n```"))
        assertEquals(plain, valid("Here's the JSON:\n$simple\nHope that helps!"))
    }

    @Test
    fun `too long text is refused before parsing`() {
        val long = "x".repeat(PasteLimits.TEXT + 1)
        assertEquals("That's too long to be one word's answer.", invalid(long))
        assertTrue(parsePastedLookup("{".padEnd(PasteLimits.TEXT, ' ') , "a") is PastedLookup.Invalid)
    }

    @Test
    fun `text that is not an object is refused`() {
        val message = "That isn't the JSON the prompt asks for. Copy the chat's whole answer and paste it again."
        assertEquals(message, invalid("no json here"))
        assertEquals(message, invalid("} then {"))
        assertEquals(message, invalid("""{"word": "a",}"""))
        assertEquals(message, invalid("""{word: "a"}"""))
    }

    @Test
    fun `a missing word is refused`() {
        assertEquals("The answer has no \"word\".", invalid("""{"definitions": []}"""))
        assertEquals("The answer has no \"word\".", invalid("""{"word": "  ", "definitions": []}"""))
        assertEquals("The answer has no \"word\".", invalid("""{"word": 5, "definitions": []}"""))
    }

    @Test
    fun `the prompt pasted back is refused`() {
        val message = "That's the prompt, not the chat's answer. Paste the chat's reply instead."
        assertEquals(message, invalid(lookupPrompt("practice")))
        assertEquals(message, invalid("""{"word": "…", "definitions": []}"""))
    }

    @Test
    fun `missing definitions are refused`() {
        val message = "The answer has no definitions."
        assertEquals(message, invalid("""{"word": "a"}"""))
        assertEquals(message, invalid("""{"word": "a", "definitions": "x"}"""))
        assertEquals(message, invalid("""{"word": "a", "definitions": []}"""))
    }

    @Test
    fun `a definition without text names its number`() {
        val good = definition("ok", form("practice", "I practice."))
        assertEquals(
            "Definition 2 has no text.",
            invalid(answer("practice", good, """{"text": " ", "forms": []}""")),
        )
        assertEquals(
            "Definition 1 has no text.",
            invalid(answer("practice", """{"text": 4, "forms": [${form("practice", "I practice.")}]}""")),
        )
    }

    @Test
    fun `a definition without forms is refused`() {
        assertEquals("Definition 1 has no forms.", invalid(answer("practice", """{"text": "x"}""")))
        assertEquals("Definition 1 has no forms.", invalid(answer("practice", """{"text": "x", "forms": []}""")))
        assertEquals("Definition 1 has no forms.", invalid(answer("practice", """{"text": "x", "forms": 3}""")))
    }

    @Test
    fun `a form without text is refused`() {
        assertEquals(
            "A form in definition 1 has no text.",
            invalid(answer("practice", definition("x", """{"label": "a", "examples": ["b"]}"""))),
        )
        assertEquals(
            "A form in definition 1 has no text.",
            invalid(answer("practice", definition("x", """{"text": 7, "examples": ["b"]}"""))),
        )
    }

    @Test
    fun `a form without an example is refused`() {
        val message = "“practices” has no example sentence."
        assertEquals(message, invalid(answer("practice", definition("x", form("practices")))))
        assertEquals(message, invalid(answer("practice", definition("x", form("practices", "  ")))))
        assertEquals(
            message,
            invalid(answer("practice", definition("x", """{"text": "practices", "examples": [3]}"""))),
        )
    }

    @Test
    fun `an example without its form is refused`() {
        assertEquals(
            "“He runs two clinics.” doesn't contain “practices”.",
            invalid(answer("practice", definition("x", form("practices", "He runs two clinics.")))),
        )
    }

    @Test
    fun `the first failure in document order wins`() {
        val badExample = definition("one", form("practice", "Nothing here."))
        val blank = """{"text": "", "forms": []}"""
        assertEquals(
            "“Nothing here.” doesn't contain “practice”.",
            invalid(answer("practice", badExample, blank)),
        )
        val long = "I practice " + "x".repeat(PasteLimits.EXAMPLE)
        val missing = definition("one", form("practice", long), form("practices"))
        assertEquals("“practices” has no example sentence.", invalid(answer("practice", missing)))
    }

    @Test
    fun `each limit is valid at the limit and refused one over`() {
        val tooLong = "That answer is longer than a word needs. Ask the chat for a shorter one."
        fun withDefinition(text: String = "d", pos: String = "noun") =
            answer("practice", definition(text, form("practice", "I practice."), pos = pos))

        assertTrue(parsePastedLookup(withDefinition("d".repeat(PasteLimits.DEFINITION)), "p") is PastedLookup.Valid)
        assertEquals(tooLong, invalid(withDefinition("d".repeat(PasteLimits.DEFINITION + 1))))
        assertTrue(parsePastedLookup(withDefinition(pos = "p".repeat(PasteLimits.PART_OF_SPEECH)), "p") is PastedLookup.Valid)
        assertEquals(tooLong, invalid(withDefinition(pos = "p".repeat(PasteLimits.PART_OF_SPEECH + 1))))

        val word = "w".repeat(PasteLimits.WORD)
        assertTrue(parsePastedLookup(answer(word, definition("d", form(word, "a $word b"))), "p") is PastedLookup.Valid)
        val over = word + "w"
        assertEquals(tooLong, invalid(answer(over, definition("d", form(over, "a $over b")))))

        val label = "l".repeat(PasteLimits.LABEL)
        assertTrue(parsePastedLookup(answer("practice", definition("d", form("practice", "I practice.", label = label))), "p") is PastedLookup.Valid)
        assertEquals(tooLong, invalid(answer("practice", definition("d", form("practice", "I practice.", label = label + "l")))))

        val example = "I practice ".padEnd(PasteLimits.EXAMPLE, 'x')
        assertTrue(parsePastedLookup(answer("practice", definition("d", form("practice", example))), "p") is PastedLookup.Valid)
        assertEquals(tooLong, invalid(answer("practice", definition("d", form("practice", example + "x")))))
    }

    @Test
    fun `count limits are valid at the limit and refused one over`() {
        val tooLong = "That answer is longer than a word needs. Ask the chat for a shorter one."
        val ex = "I practice."
        fun definitions(n: Int) = Array(n) { definition("d", form("practice", ex)) }
        assertTrue(parsePastedLookup(answer("practice", *definitions(PasteLimits.DEFINITIONS)), "p") is PastedLookup.Valid)
        assertEquals(tooLong, invalid(answer("practice", *definitions(PasteLimits.DEFINITIONS + 1))))

        fun forms(n: Int) = Array(n) { form("practice", ex) }
        assertTrue(parsePastedLookup(answer("practice", definition("d", *forms(PasteLimits.FORMS))), "p") is PastedLookup.Valid)
        assertEquals(tooLong, invalid(answer("practice", definition("d", *forms(PasteLimits.FORMS + 1)))))

        fun examples(n: Int) = Array(n) { ex }
        assertTrue(parsePastedLookup(answer("practice", definition("d", form("practice", *examples(PasteLimits.EXAMPLES)))), "p") is PastedLookup.Valid)
        assertEquals(tooLong, invalid(answer("practice", definition("d", form("practice", *examples(PasteLimits.EXAMPLES + 1))))))
    }

    @Test
    fun `a full first definition that gains a base form is still valid`() {
        val forms = Array(PasteLimits.FORMS) { form("practices", "Many practices.") }
        val result = valid(answer("practice", definition("d", *forms)))
        assertEquals(PasteLimits.FORMS + 1, result.content.definitions.first().forms.size)
    }

    @Test
    fun `blank examples are dropped and optional fields default`() {
        val text = """{"word": "practice", "extra": 1, "definitions": [{"text": "d", "forms": [
            {"text": "practice", "examples": ["", "I practice.", "  "], "other": true}]}]}"""
        val content = valid(text).content
        val definition = content.definitions.single()
        assertEquals("", definition.partOfSpeech)
        val form = definition.forms.single()
        assertEquals("", form.label)
        assertEquals(listOf(ExampleDraft("I practice.")), form.examples)
        assertTrue(content.definitions.flatMap { it.forms }.flatMap { it.examples }.all { it.shownAt == null })
        assertNull(form.examples.single().shownAt)
    }

    @Test
    fun `a base form already first stays`() {
        val result = valid(
            answer("practice", definition("d", form("practice", "I practice."), form("practices", "Many practices."))),
        )
        assertEquals(listOf("practice", "practices"), result.content.definitions[0].forms.map { it.text })
    }

    @Test
    fun `a base form second in the first definition moves first`() {
        val result = valid(
            answer("practice", definition("d", form("practices", "Many practices."), form("Practice ", "I practice."))),
        )
        assertEquals(listOf("Practice", "practices"), result.content.definitions[0].forms.map { it.text })
    }

    @Test
    fun `a base form only in the second definition is added to the first`() {
        val result = valid(
            answer(
                "practice",
                definition("d", form("practices", "Many practices.")),
                definition("e", form("practice", "I practice."), pos = "verb"),
            ),
        )
        val first = result.content.definitions[0].forms
        assertEquals(listOf("practice", "practices"), first.map { it.text })
        assertTrue(first[0].examples.isEmpty())
        assertEquals("practice", result.content.definitions[1].forms.single().text)
        assertEquals("2 definitions, 3 forms, 2 example sentences", result.content.summary())
    }

    @Test
    fun `renames only when the spelling differs`() {
        val receive = answer("receive", definition("d", form("receive", "I receive mail.")))
        assertTrue(valid(receive, "recieve").renames)
        assertFalse(valid(receive.replace("receive", "Practice"), "practice").renames)
        assertFalse(valid(receive, "").renames)
        assertFalse(valid(receive, "  ").renames)
    }

    @Test
    fun `forms need not share letters with the word`() {
        val result = valid(
            answer("practice", definition("d", form("practice", "I practice."), form("practise", "I practise."))),
        )
        assertEquals(2, result.content.definitions.single().forms.size)
    }

    @Test
    fun `summary uses singulars`() {
        val content = valid(simple).content
        assertEquals("1 definition, 1 form, 1 example sentence", content.summary())
    }

    @Test
    fun `isBlank is true for the new word draft and false once any field has text`() {
        assertTrue(WordContent.blank().isBlank())
        val blank = WordContent.blank().definitions.single()
        assertFalse(WordContent(listOf(blank.copy(text = "x"))).isBlank())
        assertFalse(WordContent(listOf(blank.copy(partOfSpeech = "noun"))).isBlank())
        val form = blank.forms.single()
        assertFalse(WordContent(listOf(blank.copy(forms = listOf(form.copy(text = "x"))))).isBlank())
        assertFalse(WordContent(listOf(blank.copy(forms = listOf(form.copy(label = "x"))))).isBlank())
        assertFalse(
            WordContent(listOf(blank.copy(forms = listOf(form.copy(examples = listOf(ExampleDraft("x"))))))).isBlank(),
        )
    }
}
