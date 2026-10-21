package io.github.dontpanic345.tortoisespelling

import android.content.Context
import io.github.dontpanic345.tortoisespelling.ui.review.Speaker
import io.github.dontpanic345.tortoisespelling.ui.review.TtsSpeaker

/** Release speaks through the device's engine and nothing else; debug wraps it to log. */
fun variantSpeakerFactory(): (Context) -> Speaker = ::TtsSpeaker
