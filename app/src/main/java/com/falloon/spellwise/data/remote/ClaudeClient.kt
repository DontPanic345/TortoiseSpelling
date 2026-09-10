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
import java.util.concurrent.TimeUnit

/** What a word lookup produced. */
sealed interface LookupResult {
    data class Success(
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
 * Direct Messages API client.
 *
 * Deliberately raw HTTP over OkHttp rather than the Anthropic Java SDK: the SDK is
 * a heavyweight server-side dependency for what is one request with three headers,
 * and this app never needs streaming, tools, or the agent loop.
 */
class ClaudeClient(
    private val http: OkHttpClient = defaultHttpClient(),
) {

    suspend fun lookup(word: String, apiKey: String, model: String): LookupResult =
        withContext(Dispatchers.IO) {
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

            when (val response = post(body, apiKey)) {
                is HttpOutcome.Error -> LookupResult.Failure(response.message)
                is HttpOutcome.Body -> parseLookup(response.json, word)
            }
        }

    /** Cheapest possible round trip, to tell a bad key from a bad network. */
    suspend fun testKey(apiKey: String, model: String): KeyTestResult =
        withContext(Dispatchers.IO) {
            val body = JSONObject()
                .put("model", model)
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

    private fun parseLookup(root: JSONObject, word: String): LookupResult {
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
            return LookupResult.Failure("Claude returned nothing for “$word”.")
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
                definition = json.optString("definition").trim(),
                example = json.optString("example").trim(),
                partOfSpeech = json.optString("partOfSpeech").trim().ifBlank { null },
            )
        } catch (error: Exception) {
            LookupResult.Unparsed(text.trim())
        }
    }

    companion object {
        const val ENDPOINT = "https://api.anthropic.com/v1/messages"
        const val ANTHROPIC_VERSION = "2023-06-01"
        private val JSON_MEDIA_TYPE = "application/json".toMediaType()

        val SYSTEM_PROMPT = buildString {
            append("You write concise spelling-flashcard content. ")
            append("Given a single word, return a JSON object with keys: ")
            append("\"definition\" (a clear dictionary-style gloss, under 25 words, that does NOT ")
            append("contain the target word or an obvious derivative of it), ")
            append("\"example\" (ONE natural sentence that uses the exact given word form verbatim), ")
            append("\"partOfSpeech\" (e.g. noun, verb, adjective). ")
            append("Return ONLY the JSON object, no prose, no code fence.")
        }

        fun defaultHttpClient(): OkHttpClient = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(45, TimeUnit.SECONDS)
            .build()
    }
}
