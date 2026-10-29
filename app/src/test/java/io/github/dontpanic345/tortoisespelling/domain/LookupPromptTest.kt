package io.github.dontpanic345.tortoisespelling.domain

import org.junit.Test
import org.junit.Assert.assertEquals

class LookupPromptTest {
    @Test
    fun `the prompt for necessary is the specified text`() {
        val expected = """
I'm learning to spell "necessary". Write flashcard content for it.

Reply with a formatted codeblock JSON object, in this shape:

{"word": "...", "definitions": [{"text": "...", "partOfSpeech": "...", "forms": [{"text": "...", "label": "...", "examples": ["..."]}]}]}

Rules:

- "word": "necessary", spelled correctly. If it's misspelled, fix it. Otherwise keep it exactly as given, including British or American spelling.
- "definitions": the word's main meanings, most common first, usually one to three. Each "text" is a short dictionary-style definition, under 25 words, that doesn't use the word or any form of it.
- "partOfSpeech": noun, verb, adjective and so on.
- "forms": the common forms of the word for that meaning, such as plurals and verb tenses. The first form of the first definition is the word itself. "label" says which form it is, such as "plural" or "past tense".
- "examples": natural sentences for each form. Each one must contain that form's "text" exactly, letter for letter, as a whole word.
- Use plain, everyday language that a learner would know, in the definitions and the example sentences.
- About a dozen example sentences in total is plenty.
""".trimStart()
        assertEquals(expected, lookupPrompt("necessary"))
    }

    @Test
    fun `the word is trimmed`() {
        assertEquals(lookupPrompt("necessary"), lookupPrompt("  necessary \n"))
    }
}
