package io.github.dontpanic345.tortoisespelling.domain

import io.github.dontpanic345.tortoisespelling.data.normalizeWord

/**
 * A word's teaching content as the editor edits it, the backup stores it and a pasted
 * lookup fills it.
 *
 * `definitions[0].forms[0]` is the base form: the word's own spelling, which saving
 * always sets to the word's text. Blank [DefinitionDraft.partOfSpeech] and
 * [FormDraft.label] mean none.
 */
data class WordContent(val definitions: List<DefinitionDraft>) {
    companion object {
        /** What a new word starts as: one blank definition, the base form, one blank example. */
        fun blank(): WordContent = WordContent(
            listOf(
                DefinitionDraft(
                    text = "",
                    forms = listOf(FormDraft(text = "", examples = listOf(ExampleDraft("")))),
                ),
            ),
        )
    }
}

data class DefinitionDraft(
    val text: String,
    val partOfSpeech: String = "",
    val forms: List<FormDraft>,
)

data class FormDraft(
    val text: String,
    val label: String = "",
    val examples: List<ExampleDraft> = emptyList(),
)

data class ExampleDraft(val text: String, val shownAt: Long? = null)

/** One definition, the base form and, when [example] isn't blank, one example. */
fun simpleContent(
    word: String,
    definition: String,
    partOfSpeech: String?,
    example: String,
): WordContent = WordContent(
    listOf(
        DefinitionDraft(
            text = definition,
            partOfSpeech = partOfSpeech.orEmpty(),
            forms = listOf(
                FormDraft(
                    text = word,
                    examples = if (example.isBlank()) emptyList() else listOf(ExampleDraft(example)),
                ),
            ),
        ),
    ),
)

private fun isBase(definitionIndex: Int, formIndex: Int) = definitionIndex == 0 && formIndex == 0

/** Trims every field and drops what is empty, keeping the base form and first definition. */
private fun WordContent.pruned(): WordContent {
    val definitions = definitions.mapIndexed { d, definition ->
        val forms = definition.forms.mapIndexedNotNull { f, form ->
            val examples = form.examples
                .map { it.copy(text = it.text.trim()) }
                .filter { it.text.isNotEmpty() }
            val trimmed = form.copy(text = form.text.trim(), label = form.label.trim(), examples = examples)
            if (!isBase(d, f) && trimmed.text.isEmpty() && examples.isEmpty()) null else trimmed
        }
        definition.copy(
            text = definition.text.trim(),
            partOfSpeech = definition.partOfSpeech.trim(),
            forms = forms,
        )
    }
    return WordContent(
        definitions.filterIndexed { d, definition ->
            d == 0 || definition.text.isNotEmpty() || definition.forms.isNotEmpty()
        },
    )
}

/**
 * What saving stores for [word]: trimmed, without empty examples, forms and later
 * definitions, with the base form set to the word and every form's spelling blanked out
 * of every definition (so "practise" can't give away "practice").
 */
fun WordContent.preparedFor(word: String): WordContent {
    val spelling = word.trim()
    val definitions = pruned().definitions
        .ifEmpty { listOf(DefinitionDraft(text = "", forms = emptyList())) }
        .mapIndexed { d, definition ->
            if (d != 0) {
                definition
            } else {
                val forms = definition.forms.ifEmpty { listOf(FormDraft(text = spelling)) }
                definition.copy(forms = listOf(forms.first().copy(text = spelling)) + forms.drop(1))
            }
        }
    val spellings = definitions.flatMap { it.forms }.map { it.text }.filter { it.isNotEmpty() }.distinct()
    return WordContent(
        definitions.map { definition ->
            definition.copy(
                text = spellings.fold(definition.text) { text, form -> hideWordInDefinition(text, form) },
            )
        },
    )
}

/** Whether every definition and every form past the base form has its text. */
fun WordContent.isComplete(): Boolean {
    val definitions = pruned().definitions
    return definitions.isNotEmpty() &&
        definitions.all { it.text.isNotEmpty() } &&
        definitions.withIndex().all { (d, definition) ->
            definition.forms.withIndex().all { (f, form) -> isBase(d, f) || form.text.isNotEmpty() }
        }
}

/** One editor action. Indices are positions: definition, then form, then example. */
sealed interface ContentEdit {
    data class DefinitionText(val definition: Int, val value: String) : ContentEdit
    data class PartOfSpeech(val definition: Int, val value: String) : ContentEdit
    data class FormText(val definition: Int, val form: Int, val value: String) : ContentEdit
    data class FormLabel(val definition: Int, val form: Int, val value: String) : ContentEdit
    data class ExampleText(val definition: Int, val form: Int, val example: Int, val value: String) : ContentEdit
    data object AddDefinition : ContentEdit
    data class RemoveDefinition(val definition: Int) : ContentEdit
    data class AddForm(val definition: Int) : ContentEdit
    data class RemoveForm(val definition: Int, val form: Int) : ContentEdit
    data class AddExample(val definition: Int, val form: Int) : ContentEdit
    data class RemoveExample(val definition: Int, val form: Int, val example: Int) : ContentEdit
}

private fun <T> List<T>.changeAt(index: Int, change: (T) -> T): List<T> =
    mapIndexed { i, item -> if (i == index) change(item) else item }

private fun <T> List<T>.without(index: Int): List<T> = filterIndexed { i, _ -> i != index }

private fun WordContent.changeDefinition(d: Int, change: (DefinitionDraft) -> DefinitionDraft) =
    WordContent(definitions.changeAt(d, change))

private fun WordContent.changeForm(d: Int, f: Int, change: (FormDraft) -> FormDraft) =
    changeDefinition(d) { it.copy(forms = it.forms.changeAt(f, change)) }

/** The content after [edit]. Removing the first definition or the base form does nothing. */
fun WordContent.apply(edit: ContentEdit): WordContent = when (edit) {
    is ContentEdit.DefinitionText -> changeDefinition(edit.definition) { it.copy(text = edit.value) }
    is ContentEdit.PartOfSpeech -> changeDefinition(edit.definition) { it.copy(partOfSpeech = edit.value) }
    is ContentEdit.FormText -> changeForm(edit.definition, edit.form) { it.copy(text = edit.value) }
    is ContentEdit.FormLabel -> changeForm(edit.definition, edit.form) { it.copy(label = edit.value) }
    is ContentEdit.ExampleText -> changeForm(edit.definition, edit.form) { form ->
        form.copy(examples = form.examples.changeAt(edit.example) { it.copy(text = edit.value) })
    }
    ContentEdit.AddDefinition -> WordContent(
        definitions + DefinitionDraft(
            text = "",
            forms = listOf(FormDraft(text = "", examples = listOf(ExampleDraft("")))),
        ),
    )
    is ContentEdit.RemoveDefinition ->
        if (edit.definition == 0) this else WordContent(definitions.without(edit.definition))
    is ContentEdit.AddForm -> changeDefinition(edit.definition) {
        it.copy(forms = it.forms + FormDraft(text = "", examples = listOf(ExampleDraft(""))))
    }
    is ContentEdit.RemoveForm ->
        if (isBase(edit.definition, edit.form)) {
            this
        } else {
            changeDefinition(edit.definition) { it.copy(forms = it.forms.without(edit.form)) }
        }
    is ContentEdit.AddExample -> changeForm(edit.definition, edit.form) {
        it.copy(examples = it.examples + ExampleDraft(""))
    }
    is ContentEdit.RemoveExample -> changeForm(edit.definition, edit.form) {
        it.copy(examples = it.examples.without(edit.example))
    }
}

/** The normalized root and every normalized form spelling: what the word list searches. */
fun WordContent.searchTerms(word: String): Set<String> =
    (listOf(word) + definitions.flatMap { definition -> definition.forms.map { it.text } })
        .map(::normalizeWord)
        .filter { it.isNotEmpty() }
        .toSet()

/** True when [example] has text but [formText] can't be blanked out of it. */
fun exampleMissesForm(example: String, formText: String): Boolean =
    example.isNotBlank() && !blankWordIn(example, formText).didBlank
