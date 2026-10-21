package io.github.dontpanic345.tortoisespelling.domain

const val SPEECH_RATE = 0.8f

/** A tag's language and region, lower-cased; the region is null when it has none. */
private fun languageAndRegion(tag: String): Pair<String, String?> {
    val parts = tag.lowercase().replace('_', '-').split('-')
    val region = parts.drop(1).firstOrNull { part ->
        (part.length == 2 && part.all { it in 'a'..'z' }) || (part.length == 3 && part.all { it in '0'..'9' })
    }
    return parts[0] to region
}

/**
 * The voice to speak with: its index in [voices] (the tags of the on-device voices, in the
 * caller's order), or null when none will do. An index, because an engine often has several
 * voices with one tag. Only language and region count: Android 14 puts `-u-…` extensions on the
 * device locale.
 */
fun chooseVoice(voices: List<String>, deviceLocales: List<String>): Int? {
    val tags = voices.map(::languageAndRegion)
    for (locale in deviceLocales) {
        val (language, region) = languageAndRegion(locale)
        if (language != "en" || region == null) continue
        val index = tags.indexOfFirst { it.first == language && it.second == region }
        if (index >= 0) return index
    }
    return tags.indexOfFirst { it.first == "en" }.takeIf { it >= 0 }
}
