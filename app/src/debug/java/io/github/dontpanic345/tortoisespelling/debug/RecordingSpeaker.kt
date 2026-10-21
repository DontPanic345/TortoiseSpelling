package io.github.dontpanic345.tortoisespelling.debug

import android.util.Log
import io.github.dontpanic345.tortoisespelling.ui.review.Speaker
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * Debug builds only. Always ready and logs `spoke "<text>"` under [TAG], so the e2e suite
 * can check a tap without a TTS engine; passes through to [real] when that is ready.
 * `adb logcat -d -s TortoiseSpeech`.
 */
class RecordingSpeaker(private val real: Speaker) : Speaker {
    override val ready: StateFlow<Boolean> = MutableStateFlow(true)

    override fun speak(text: String) {
        Log.i(TAG, "spoke \"$text\"")
        if (real.ready.value) real.speak(text)
    }

    override fun shutdown() = real.shutdown()

    companion object {
        const val TAG = "TortoiseSpeech"
    }
}
