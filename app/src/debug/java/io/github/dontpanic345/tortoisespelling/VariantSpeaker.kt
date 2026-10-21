package io.github.dontpanic345.tortoisespelling

import android.content.Context
import io.github.dontpanic345.tortoisespelling.debug.RecordingSpeaker
import io.github.dontpanic345.tortoisespelling.ui.review.Speaker
import io.github.dontpanic345.tortoisespelling.ui.review.TtsSpeaker

/** Debug logs what is spoken, so the e2e suite can check it on an image with no TTS engine. */
fun variantSpeakerFactory(): (Context) -> Speaker = { context -> RecordingSpeaker(TtsSpeaker(context)) }
