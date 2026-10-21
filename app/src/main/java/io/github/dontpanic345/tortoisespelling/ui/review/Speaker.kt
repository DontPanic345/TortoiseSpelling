package io.github.dontpanic345.tortoisespelling.ui.review

import kotlinx.coroutines.flow.StateFlow

/** Speaks a word aloud. [ready] is false until a usable on-device voice is set up. */
interface Speaker {
    val ready: StateFlow<Boolean>

    fun speak(text: String)

    fun shutdown()
}
