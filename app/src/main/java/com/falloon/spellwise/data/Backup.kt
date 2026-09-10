package com.falloon.spellwise.data

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
)

val BackupJson = Json {
    prettyPrint = true
    ignoreUnknownKeys = true
    encodeDefaults = true
}

fun Word.toBackup() = BackupWord(
    text = text,
    definition = definition,
    example = example,
    partOfSpeech = partOfSpeech,
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
)

fun BackupWord.toWord() = Word(
    text = text.trim(),
    normalizedText = normalizeWord(text),
    definition = definition,
    example = example,
    partOfSpeech = partOfSpeech,
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
)

/** Thrown when a file is not a Spellwise backup, or is from a newer app version. */
class BackupFormatException(message: String) : Exception(message)

fun parseBackup(raw: String): BackupFile {
    val backup = try {
        BackupJson.decodeFromString(BackupFile.serializer(), raw)
    } catch (error: Exception) {
        throw BackupFormatException("That file isn't a Spellwise backup.")
    }
    if (backup.version > BackupFile.CURRENT_VERSION) {
        throw BackupFormatException(
            "That backup was made by a newer version of Spellwise (v${backup.version}).",
        )
    }
    return backup
}
