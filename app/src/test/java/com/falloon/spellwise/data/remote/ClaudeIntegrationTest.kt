package com.falloon.spellwise.data.remote

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeFalse
import org.junit.Before
import org.junit.Test

/**
 * Hits the real Anthropic API. Skipped unless SPELLWISE_ANTHROPIC_KEY is set in the
 * environment, so it never runs (and never needs a key) in a normal test pass.
 *
 * Run with:
 *   SPELLWISE_ANTHROPIC_KEY=sk-ant-... ./gradlew testDebugUnitTest --tests '*ClaudeIntegrationTest'
 */
class ClaudeIntegrationTest {

    private val apiKey: String = System.getenv("SPELLWISE_ANTHROPIC_KEY").orEmpty()
    private val client = ClaudeClient()

    @Before
    fun requireKey() {
        assumeFalse("SPELLWISE_ANTHROPIC_KEY not set — skipping live API test", apiKey.isBlank())
    }

    @Test
    fun `the key is accepted`() = runBlocking {
        assertEquals(KeyTestResult.Ok, client.testKey(apiKey))
    }

    @Test
    fun `model discovery picks a haiku-tier model`() {
        val model = client.resolveModel(apiKey)
        println("resolved lookup model: $model")
        assertTrue(
            "expected a haiku-tier model, got $model",
            model.contains("haiku", ignoreCase = true),
        )
    }

    @Test
    fun `a correctly spelled word round-trips`() = runBlocking {
        val result = client.lookup("punctuation", apiKey)
        println("punctuation -> $result")
        result as LookupResult.Success
        assertEquals("punctuation", result.word.lowercase())
        assertFalse(
            "definition should not give the word away: ${result.definition}",
            result.definition.contains("punctuation", ignoreCase = true),
        )
        assertTrue(
            "example should contain the word: ${result.example}",
            result.example.contains("punctuation", ignoreCase = true),
        )
    }

    @Test
    fun `a misspelled word comes back corrected`() = runBlocking {
        val result = client.lookup("punchuation", apiKey)
        println("punchuation -> $result")
        result as LookupResult.Success
        assertEquals(
            "the misspelling should be corrected",
            "punctuation",
            result.word.lowercase(),
        )
        assertFalse(
            "the example must not carry the misspelling: ${result.example}",
            result.example.contains("punchuation", ignoreCase = true),
        )
        assertTrue(
            "the example should use the corrected word: ${result.example}",
            result.example.contains("punctuation", ignoreCase = true),
        )
    }

    @Test
    fun `a second misspelling is corrected`() = runBlocking {
        val result = client.lookup("recieve", apiKey)
        println("recieve -> $result")
        result as LookupResult.Success
        assertEquals("receive", result.word.lowercase())
    }
}
