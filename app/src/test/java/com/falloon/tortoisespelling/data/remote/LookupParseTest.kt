package com.falloon.tortoisespelling.data.remote

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LookupParseTest {

    /** Wraps [modelText] as the text block of a Messages API response. */
    private fun response(modelText: String, stopReason: String = "end_turn"): JSONObject =
        JSONObject(
            """
            {
              "stop_reason": "$stopReason",
              "content": [ { "type": "text", "text": ${JSONObject.quote(modelText)} } ]
            }
            """.trimIndent(),
        )

    @Test
    fun `adopts the corrected spelling from the model`() {
        val result = parseLookup(
            response(
                """{"word":"punctuation","definition":"Marks that structure written text.",
                   "example":"Good punctuation makes a sentence easy to read.",
                   "partOfSpeech":"noun"}""",
            ),
            typedWord = "punchuation",
        )
        result as LookupResult.Success
        assertEquals("punctuation", result.word)
        assertEquals("noun", result.partOfSpeech)
        assertTrue(result.example.contains("punctuation"))
    }

    @Test
    fun `keeps the typed word when the model omits the word key`() {
        val result = parseLookup(
            response("""{"definition":"A greeting.","example":"She gave a warm hello."}"""),
            typedWord = "hello",
        )
        result as LookupResult.Success
        assertEquals("hello", result.word)
    }

    @Test
    fun `tolerates a code fence around the json`() {
        val result = parseLookup(
            response("```json\n{\"word\":\"cat\",\"definition\":\"A small pet.\"}\n```"),
            typedWord = "cat",
        )
        result as LookupResult.Success
        assertEquals("cat", result.word)
        assertEquals("A small pet.", result.definition)
    }

    @Test
    fun `surfaces raw text when there is no json to parse`() {
        val result = parseLookup(response("I couldn't come up with a definition."), typedWord = "x")
        assertTrue(result is LookupResult.Unparsed)
    }

    @Test
    fun `reports a refusal`() {
        val result = parseLookup(response("", stopReason = "refusal"), typedWord = "x")
        assertTrue(result is LookupResult.Refused)
    }

    @Test
    fun `blank part of speech becomes null`() {
        val result = parseLookup(
            response("""{"word":"cat","definition":"A pet.","partOfSpeech":"  "}"""),
            typedWord = "cat",
        )
        result as LookupResult.Success
        assertEquals(null, result.partOfSpeech)
    }
}
