package io.github.dontpanic345.tortoisespelling.data

import io.github.dontpanic345.tortoisespelling.domain.DefinitionDraft
import io.github.dontpanic345.tortoisespelling.domain.ExampleDraft
import io.github.dontpanic345.tortoisespelling.domain.FormDraft
import io.github.dontpanic345.tortoisespelling.domain.WordContent
import io.github.dontpanic345.tortoisespelling.domain.simpleContent
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * On-disk backup format.
 *
 * [version] exists so a future schema change does not make today's backups
 * unreadable — the one file the user cannot regenerate deserves a version tag.
 */
@Serializable
data class BackupFile(
    val version: Int = CURRENT_VERSION,
    val exportedAt: Long = System.currentTimeMillis(),
    val words: List<BackupWord>,
) {
    companion object {
        const val CURRENT_VERSION = 1
    }
}

@Serializable
data class BackupWord(
    val text: String,
    val definition: String,
    val example: String = "",
    @SerialName("partOfSpeech") val partOfSpeech: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val repetitions: Int = 0,
    val easeFactor: Double = 2.5,
    val intervalDays: Int = 0,
    val dueOn: Long,
    val lapses: Int = 0,
    val lastReviewedAt: Long? = null,
    val firstReviewedOn: Long? = null,
    val isNew: Boolean = true,
    val suspended: Boolean = false,
    // Defaulted, so a backup taken before these existed still reads. The file format
    // version stays at 1: an older build ignores unknown keys, so a file written here
    // is still readable there, and bumping it would make this app refuse its own
    // backups on a downgrade.
    val autoRefresh: Boolean = false,
    val refreshedOn: Long? = null,
    // The whole teaching tree. The flat fields above mirror its root card, so an older
    // build reads this file as it always did and the format version stays 1.
    val definitions: List<BackupDefinition> = emptyList(),
)

@Serializable
data class BackupDefinition(
    val text: String,
    val partOfSpeech: String? = null,
    val forms: List<BackupForm> = emptyList(),
)

@Serializable
data class BackupForm(
    val text: String,
    val label: String? = null,
    val examples: List<BackupExample> = emptyList(),
)

@Serializable
data class BackupExample(val text: String, val shownAt: Long? = null)

val BackupJson = Json {
    prettyPrint = true
    ignoreUnknownKeys = true
    encodeDefaults = true
}

/** The flat fields come from the root card: the first definition and the base form's first example. */
fun WordWithContent.toBackup(): BackupWord {
    val definition = sorted().definitions.firstOrNull()
    val tree = toContent().definitions.map { it.toBackup() }
    return BackupWord(
        text = word.text,
        definition = definition?.definition?.text.orEmpty(),
        example = definition?.forms?.firstOrNull()?.examples?.firstOrNull()?.text.orEmpty(),
        partOfSpeech = definition?.definition?.partOfSpeech,
        createdAt = word.createdAt,
        repetitions = word.repetitions,
        easeFactor = word.easeFactor,
        intervalDays = word.intervalDays,
        dueOn = word.dueOn,
        lapses = word.lapses,
        lastReviewedAt = word.lastReviewedAt,
        firstReviewedOn = word.firstReviewedOn,
        isNew = word.isNew,
        suspended = word.suspended,
        autoRefresh = word.autoRefresh,
        refreshedOn = word.refreshedOn,
        definitions = tree,
    )
}

private fun DefinitionDraft.toBackup() = BackupDefinition(
    text = text,
    partOfSpeech = partOfSpeech.ifBlank { null },
    forms = forms.map { form ->
        BackupForm(
            text = form.text,
            label = form.label.ifBlank { null },
            examples = form.examples.map { BackupExample(it.text, it.shownAt) },
        )
    },
)

private fun BackupDefinition.toDraft() = DefinitionDraft(
    text = text,
    partOfSpeech = partOfSpeech.orEmpty(),
    forms = forms.map { form ->
        FormDraft(
            text = form.text,
            label = form.label.orEmpty(),
            examples = form.examples.map { ExampleDraft(it.text, it.shownAt) },
        )
    },
)

fun BackupWord.toImport() = ImportedWord(
    word = Word(
        text = text.trim(),
        normalizedText = normalizeWord(text),
        createdAt = createdAt,
        repetitions = repetitions,
        easeFactor = easeFactor,
        intervalDays = intervalDays,
        dueOn = dueOn,
        lapses = lapses,
        lastReviewedAt = lastReviewedAt,
        firstReviewedOn = firstReviewedOn,
        isNew = isNew,
        suspended = suspended,
        autoRefresh = autoRefresh,
        refreshedOn = refreshedOn,
    ),
    content = if (definitions.isEmpty()) {
        simpleContent(text, definition, partOfSpeech, example)
    } else {
        WordContent(definitions.map { it.toDraft() })
    },
)

/** Thrown when a file is not a Tortoise Spelling backup, or is from a newer app version. */
class BackupFormatException(message: String) : Exception(message)

fun parseBackup(raw: String): BackupFile {
    val backup = try {
        BackupJson.decodeFromString(BackupFile.serializer(), raw)
    } catch (error: Exception) {
        throw BackupFormatException("That file isn't a Tortoise Spelling backup.")
    }
    if (backup.version > BackupFile.CURRENT_VERSION) {
        throw BackupFormatException(
            "That backup was made by a newer version of Tortoise Spelling (v${backup.version}).",
        )
    }
    return backup
}
