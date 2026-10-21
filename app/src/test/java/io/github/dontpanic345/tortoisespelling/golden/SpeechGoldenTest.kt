package io.github.dontpanic345.tortoisespelling.golden

import io.github.dontpanic345.tortoisespelling.domain.SPEECH_RATE
import io.github.dontpanic345.tortoisespelling.domain.chooseVoice
import io.github.dontpanic345.tortoisespelling.golden.Golden.forEachCase
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Test

class SpeechGoldenTest {
    private val file = Golden.load("speech")

    @Test
    fun everyFunctionHasARunner() = Golden.assertFunctions(file, setOf("speechRate", "chooseVoice"))

    @Test
    fun speechRate() = assertEquals(file.getValue("speechRate").jsonPrimitive.content.toFloat(), SPEECH_RATE)

    @Test
    fun chooseVoice() = forEachCase(file, "chooseVoice") { c ->
        val out = c.getValue("out").takeIf { it !is JsonNull }?.jsonPrimitive?.content?.toInt()
        assertEquals(out, chooseVoice(c.strings("voices"), c.strings("deviceLocales")))
    }
}
