package com.falloon.spellwise.data.remote

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.time.Duration
import java.util.concurrent.TimeUnit

/** What a word lookup produced. */
sealed interface LookupResult {
    data class Success(
        /** The correctly spelled word. May differ from what the user typed. */
        val word: String,
        val definition: String,
        val example: String,
        val partOfSpeech: String?,
    ) : LookupResult

    /** Claude answered, but not with the JSON we asked for. Raw text is offered for hand-editing. */
    data class Unparsed(val rawText: String) : LookupResult

    /** Claude declined this word. */
    data class Refused(val message: String) : LookupResult

    data class Failure(val message: String) : LookupResult
}

sealed interface KeyTestResult {
    data object Ok : KeyTestResult
    data object Rejected : KeyTestResult
    data class Failure(val message: String) : KeyTestResult
}

/**
 * Chooses which model a lookup runs on.
 *
 * There is no user-facing model picker: lookups always use the cheapest tier. The
 * choice is made at runtime from `GET /v1/models` so the app follows Anthropic's
 * lineup on its own — a newer Haiku-tier model is adopted with no update, and a
 * retired one is simply never picked. [FALLBACK] covers the case where discovery
 * fails or the cheap tier has been renamed out from under us.
 */
object LookupModel {

    /**
     * Used when model discovery returns nothing usable. Bump this only if Anthropic
     * retires the Haiku 4.5 generation *and* renames the tier so discovery can no
     * longer find it; newer Haiku releases are handled by [pick] without a change here.
     */
    const val FALLBACK = "claude-haiku-4-5"

    /** One entry from the models list. */
    data class Candidate(val id: String, val createdAt: String)

    /**
     * The cheapest model to use: the newest release whose id marks it as the fast,
     * low-cost "haiku" tier. Ties on date prefer the shorter id, which is the clean
     * alias (`claude-haiku-4-5`) over a dated snapshot.
     */
    fun pick(candidates: List<Candidate>): String =
        candidates
            .filter { it.id.contains("haiku", ignoreCase = true) }
            // created_at is ISO-8601, so lexical order is chronological order.
            .sortedWith(compareByDescending<Candidate> { it.createdAt }.thenBy { it.id.length })
            .firstOrNull()
            ?.id
            ?: FALLBACK
}

/**
 * Direct Messages API client.
 *
 * Deliberately raw HTTP over OkHttp rather than the Anthropic Java SDK: the SDK is
 * a heavyweight server-side dependency for what is one request with three headers,
 * and this app never needs streaming, tools, or the agent loop.
 */
class ClaudeClient(
    private val http: OkHttpClient = defaultHttpClient(),
) {

    /** Resolved once per process; a 404 on a lookup clears it so discovery re-runs. */
    @Volatile
    private var cachedModel: String? = null

    suspend fun lookup(word: String, apiKey: String): LookupResult =
        withContext(Dispatchers.IO) {
            val outcome = requestLookup(word, apiKey, resolveModel(apiKey))
            val settled = if (outcome is HttpOutcome.Error && outcome.status == 404) {
                // The resolved model was retired between discovery and now. Forget it
                // and try once more with a fresh pick.
                cachedModel = null
                requestLookup(word, apiKey, resolveModel(apiKey))
            } else {
                outcome
            }
            when (settled) {
                is HttpOutcome.Error -> LookupResult.Failure(settled.message)
                is HttpOutcome.Body -> parseLookup(settled.json, word)
            }
        }

    /** Cheapest possible round trip, to tell a bad key from a bad network. */
    suspend fun testKey(apiKey: String): KeyTestResult =
        withContext(Dispatchers.IO) {
            val body = JSONObject()
                .put("model", resolveModel(apiKey))
                .put("max_tokens", 1)
                .put(
                    "messages",
                    JSONArray().put(JSONObject().put("role", "user").put("content", "Hi")),
                )
            when (val response = post(body, apiKey)) {
                is HttpOutcome.Body -> KeyTestResult.Ok
                is HttpOutcome.Error ->
                    if (response.status == 401 || response.status == 403) {
                        KeyTestResult.Rejected
                    } else {
                        KeyTestResult.Failure(response.message)
                    }
            }
        }

    private fun requestLookup(word: String, apiKey: String, model: String): HttpOutcome {
        val body = JSONObject()
            .put("model", model)
            .put("max_tokens", 400)
            .put("system", SYSTEM_PROMPT)
            .put(
                "messages",
                JSONArray().put(
                    JSONObject().put("role", "user").put("content", "Word: $word"),
                ),
            )
        return post(body, apiKey)
    }

    // --- model discovery ---

    /** Internal (not private) so integration tests can see which model discovery chose. */
    internal fun resolveModel(apiKey: String): String {
        cachedModel?.let { return it }
        val resolved = discoverModel(apiKey) ?: LookupModel.FALLBACK
        cachedModel = resolved
        return resolved
    }

    private fun discoverModel(apiKey: String): String? {
        if (apiKey.isBlank()) {
            return null
        }
        val request = Request.Builder()
            .url("$MODELS_ENDPOINT?limit=1000")
            .addHeader("x-api-key", apiKey)
            .addHeader("anthropic-version", ANTHROPIC_VERSION)
            .get()
            .build()
        return try {
            // A short call timeout so a hung discovery never holds up the first lookup;
            // failure here just means the fallback model is used.
            http.newBuilder()
                .callTimeout(Duration.ofSeconds(10))
                .build()
                .newCall(request)
                .execute()
                .use { response ->
                    if (!response.isSuccessful) {
                        return null
                    }
                    val data = JSONObject(response.body?.string().orEmpty())
                        .optJSONArray("data")
                        ?: return null
                    val candidates = (0 until data.length())
                        .mapNotNull { data.optJSONObject(it) }
                        .mapNotNull { entry ->
                            val id = entry.optString("id")
                            if (id.isBlank()) {
                                null
                            } else {
                                LookupModel.Candidate(id, entry.optString("created_at"))
                            }
                        }
                    if (candidates.isEmpty()) null else LookupModel.pick(candidates)
                }
        } catch (error: Exception) {
            null
        }
    }

    // --- shared request plumbing ---

    private sealed interface HttpOutcome {
        data class Body(val json: JSONObject) : HttpOutcome
        data class Error(val message: String, val status: Int = 0) : HttpOutcome
    }

    private fun post(body: JSONObject, apiKey: String): HttpOutcome {
        if (apiKey.isBlank()) {
            return HttpOutcome.Error("Add your API key in Settings first.")
        }
        val request = Request.Builder()
            .url(ENDPOINT)
            .addHeader("x-api-key", apiKey)
            .addHeader("anthropic-version", ANTHROPIC_VERSION)
            .addHeader("content-type", "application/json")
            .post(body.toString().toRequestBody(JSON_MEDIA_TYPE))
            .build()

        return try {
            http.newCall(request).execute().use { response ->
                val text = response.body?.string().orEmpty()
                if (response.isSuccessful) {
                    HttpOutcome.Body(JSONObject(text))
                } else {
                    HttpOutcome.Error(messageForStatus(response.code), response.code)
                }
            }
        } catch (error: IOException) {
            HttpOutcome.Error("Couldn't reach Claude — you can type the definition yourself.")
        } catch (error: Exception) {
            HttpOutcome.Error("Unexpected response from Claude — type the definition yourself.")
        }
    }

    private fun messageForStatus(status: Int): String = when (status) {
        401, 403 -> "API key rejected — check it in Settings."
        429 -> "Rate limited — try again in a moment."
        in 500..599 -> "Claude is having trouble — try again shortly."
        else -> "Lookup failed (HTTP $status) — you can type the definition yourself."
    }

    companion object {
        const val ENDPOINT = "https://api.anthropic.com/v1/messages"
        const val MODELS_ENDPOINT = "https://api.anthropic.com/v1/models"
        const val ANTHROPIC_VERSION = "2023-06-01"
        private val JSON_MEDIA_TYPE = "application/json".toMediaType()

        val SYSTEM_PROMPT = buildString {
            append("You write concise spelling-flashcard content. ")
            append("The user gives you one word, which may be misspelled. ")
            append("Return ONLY a JSON object (no prose, no code fence) with keys: ")
            append("\"word\" (the correctly spelled form of the word, with any spelling ")
            append("mistake fixed), ")
            append("\"definition\" (a clear dictionary-style gloss, under 25 words, that does ")
            append("NOT contain the word or an obvious derivative of it), ")
            append("\"example\" (ONE natural sentence that uses the correctly spelled word ")
            append("verbatim), ")
            append("\"partOfSpeech\" (e.g. noun, verb, adjective).")
        }

        fun defaultHttpClient(): OkHttpClient = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(45, TimeUnit.SECONDS)
            .build()
    }
}

/**
 * Parse a Messages API response into a [LookupResult].
 *
 * [typedWord] is the fallback spelling used when the model omits the "word" key.
 * Top-level and internal so it can be unit-tested without a wire call.
 */
internal fun parseLookup(root: JSONObject, typedWord: String): LookupResult {
    if (root.optString("stop_reason") == "refusal") {
        return LookupResult.Refused("Claude declined this word — fill the fields in yourself.")
    }
    val text = root.optJSONArray("content")
        ?.let { content ->
            (0 until content.length())
                .mapNotNull { content.optJSONObject(it) }
                .firstOrNull { it.optString("type") == "text" }
                ?.optString("text")
        }
        .orEmpty()

    if (text.isBlank()) {
        return LookupResult.Failure("Claude returned nothing for “$typedWord”.")
    }

    // Be forgiving about a stray code fence or a sentence of preamble.
    val start = text.indexOf('{')
    val end = text.lastIndexOf('}')
    if (start < 0 || end <= start) {
        return LookupResult.Unparsed(text.trim())
    }
    return try {
        val json = JSONObject(text.substring(start, end + 1))
        LookupResult.Success(
            word = json.optString("word").trim().ifBlank { typedWord.trim() },
            definition = json.optString("definition").trim(),
            example = json.optString("example").trim(),
            partOfSpeech = json.optString("partOfSpeech").trim().ifBlank { null },
        )
    } catch (error: Exception) {
        LookupResult.Unparsed(text.trim())
    }
}
