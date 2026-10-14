package io.github.dontpanic345.tortoisespelling.data

import androidx.room.Embedded
import androidx.room.Relation
import io.github.dontpanic345.tortoisespelling.domain.DefinitionDraft
import io.github.dontpanic345.tortoisespelling.domain.ExampleDraft
import io.github.dontpanic345.tortoisespelling.domain.FormDraft
import io.github.dontpanic345.tortoisespelling.domain.WordContent

/** A word with its whole teaching tree, as Room loads it. Call [sorted] before reading. */
data class WordWithContent(
    @Embedded val word: Word,
    @Relation(entity = Definition::class, parentColumn = "id", entityColumn = "wordId")
    val definitions: List<DefinitionWithForms>,
)

data class DefinitionWithForms(
    @Embedded val definition: Definition,
    @Relation(entity = WordForm::class, parentColumn = "id", entityColumn = "definitionId")
    val forms: List<FormWithExamples>,
)

data class FormWithExamples(
    @Embedded val form: WordForm,
    @Relation(entity = ExampleSentence::class, parentColumn = "id", entityColumn = "wordFormId")
    val examples: List<ExampleSentence>,
)

/** Relations come back unordered; this puts every level in its `orderIndex` order. */
fun WordWithContent.sorted(): WordWithContent = copy(
    definitions = definitions.sortedBy { it.definition.orderIndex }.map { definition ->
        definition.copy(
            forms = definition.forms.sortedBy { it.form.orderIndex }.map { form ->
                form.copy(examples = form.examples.sortedBy { it.orderIndex })
            },
        )
    },
)

/** The tree as the editor, the backup and the paste see it: sorted, nulls as blanks. */
fun WordWithContent.toContent(): WordContent = WordContent(
    sorted().definitions.map { definition ->
        DefinitionDraft(
            text = definition.definition.text,
            partOfSpeech = definition.definition.partOfSpeech.orEmpty(),
            forms = definition.forms.map { form ->
                FormDraft(
                    text = form.form.text,
                    label = form.form.label.orEmpty(),
                    examples = form.examples.map { ExampleDraft(it.text, it.shownAt) },
                )
            },
        )
    },
)
