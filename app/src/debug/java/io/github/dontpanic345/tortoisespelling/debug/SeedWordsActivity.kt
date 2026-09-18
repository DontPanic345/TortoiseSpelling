package io.github.dontpanic345.tortoisespelling.debug

import android.os.Bundle
import android.util.Base64
import androidx.activity.ComponentActivity
import androidx.lifecycle.lifecycleScope
import io.github.dontpanic345.tortoisespelling.TortoiseSpellingApp
import kotlinx.coroutines.launch
import org.json.JSONArray

/**
 * Adds words for the e2e suite, through the same [addWord][io.github.dontpanic345.tortoisespelling.data.WordRepository.addWord]
 * the Add screen uses, then finishes. It's translucent, so the screen underneath only
 * pauses, and resumes (and refreshes) when this finishes.
 *
 * `adb shell am start -W -n <app id>/.debug.SeedWordsActivity --es words <base64 JSON>`,
 * where the JSON is `[{"word": ..., "definition": ..., "example": ...}]`. Base64, so the
 * device shell never has to quote it.
 */
class SeedWordsActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val json = String(Base64.decode(intent.getStringExtra(EXTRA_WORDS).orEmpty(), Base64.DEFAULT))
        val words = JSONArray(json.ifEmpty { "[]" })
        val repository = (application as TortoiseSpellingApp).container.repository
        lifecycleScope.launch {
            for (index in 0 until words.length()) {
                val word = words.getJSONObject(index)
                repository.addWord(
                    text = word.getString("word"),
                    definition = word.optString("definition"),
                    example = word.optString("example"),
                    partOfSpeech = word.optString("partOfSpeech").ifEmpty { null },
                )
            }
            finish()
        }
    }

    companion object {
        const val EXTRA_WORDS = "words"
    }
}
