package io.github.dontpanic345.tortoisespelling.ui.review

import android.content.Context
import android.os.LocaleList
import android.speech.tts.TextToSpeech
import android.speech.tts.Voice
import io.github.dontpanic345.tortoisespelling.domain.SPEECH_RATE
import io.github.dontpanic345.tortoisespelling.domain.chooseVoice
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * The device's own text-to-speech engine, with an on-device English voice. [ready] stays
 * false when the engine fails to start or has no voice [chooseVoice] will take, so the
 * button is hidden rather than speaking through the network or in the wrong language.
 */
class TtsSpeaker(context: Context) : Speaker {
    private val mutableReady = MutableStateFlow(false)
    override val ready: StateFlow<Boolean> = mutableReady

    private val engine: TextToSpeech = TextToSpeech(context.applicationContext) { status ->
        if (status == TextToSpeech.SUCCESS) mutableReady.value = chooseAndSetVoice()
    }

    private fun chooseAndSetVoice(): Boolean {
        val voices = onDeviceVoices(engine.voices.orEmpty())
        val deviceLocales = LocaleList.getDefault().let { list -> List(list.size()) { list[it].toLanguageTag() } }
        val index = chooseVoice(voices.map { it.locale.toLanguageTag() }, deviceLocales) ?: return false
        if (engine.setVoice(voices[index]) == TextToSpeech.ERROR) return false
        engine.setSpeechRate(SPEECH_RATE)
        return true
    }

    override fun speak(text: String) {
        engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, null)
    }

    override fun shutdown() {
        engine.stop()
        engine.shutdown()
    }
}

/**
 * The voices that work without the network or a download, sorted by name because the
 * engine hands them over as a [Set] with no stable order.
 */
private fun onDeviceVoices(voices: Collection<Voice>): List<Voice> = voices
    .filter { !it.isNetworkConnectionRequired && TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED !in it.features }
    .sortedBy { it.name }
