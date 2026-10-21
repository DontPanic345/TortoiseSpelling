package io.github.dontpanic345.tortoisespelling.domain

/** A form that probably isn't a real form of its word: where it is and what to tell the user. */
data class FormWarning(val definition: Int, val form: Int, val message: String)

/**
 * The suspect forms in [content], in content order (definition, then form); empty for a
 * clean word. The base form (definition 0, form 0) is never flagged: saving sets it to [word].
 */
fun formWarnings(word: String, content: WordContent): List<FormWarning> {
    // A phrase root ("ice cream") may have spaced forms ("ice creams").
    if (word.trim().any(Char::isWhitespace)) return emptyList()
    val warnings = mutableListOf<FormWarning>()
    content.definitions.forEachIndexed { d, definition ->
        definition.forms.forEachIndexed { f, form ->
            if (d == 0 && f == 0) return@forEachIndexed
            val text = form.text.trim()
            if (text.any(Char::isWhitespace)) {
                warnings += FormWarning(d, f, "“$text” is more than one word. Spelling review asks for one word.")
            }
        }
    }
    return warnings
}
