package io.github.dontpanic345.tortoisespelling.data.remote

import io.github.dontpanic345.tortoisespelling.domain.blankWordIn
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeFalse
import org.junit.Before
import org.junit.Test

/**
 * Hits the real Anthropic API. Skipped unless TORTOISESPELLING_ANTHROPIC_KEY is set in the
 * environment, so it never runs (and never needs a key) in a normal test pass.
 *
 * Run with:
 *   TORTOISESPELLING_ANTHROPIC_KEY=sk-ant-... ./gradlew testDebugUnitTest --tests '*ClaudeIntegrationTest'
 */
class ClaudeIntegrationTest {

    private val apiKey: String = System.getenv("TORTOISESPELLING_ANTHROPIC_KEY").orEmpty()
    private val client = ClaudeClient()

    @Before
    fun requireKey() {
        assumeFalse("TORTOISESPELLING_ANTHROPIC_KEY not set — skipping live API test", apiKey.isBlank())
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
        assertExampleUsesExactForm(result)
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
        assertExampleUsesExactForm(result)
    }

    @Test
    fun `a second misspelling is corrected`() = runBlocking {
        val result = client.lookup("recieve", apiKey)
        println("recieve -> $result")
        result as LookupResult.Success
        assertEquals("receive", result.word.lowercase())
        assertExampleUsesExactForm(result)
    }

    @Test
    fun `verbs come back in a blank-able form`() = runBlocking {
        // "run" is easy to hand back only as "running" / "ran"; the prompt forbids that.
        for (word in listOf("accommodate", "run", "occurrence")) {
            val result = client.lookup(word, apiKey)
            println("$word -> ${(result as LookupResult.Success).example}")
            assertExampleUsesExactForm(result)
        }
    }

    /**
     * The review screen can only blank the word inside the example when the exact
     * spelled form appears there as a whole word. This is the behaviour the prompt
     * change exists to guarantee.
     */
    private fun assertExampleUsesExactForm(result: LookupResult.Success) {
        assertTrue(
            "example must contain \"${result.word}\" as a whole word: ${result.example}",
            blankWordIn(result.example, result.word).didBlank,
        )
    }
}
