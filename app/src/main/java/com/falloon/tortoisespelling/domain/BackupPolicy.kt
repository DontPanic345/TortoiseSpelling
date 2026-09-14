package com.falloon.tortoisespelling.domain

/**
 * Mirrors `android.app.backup.BackupAgent.FLAG_DEVICE_TO_DEVICE_TRANSFER` (API 28+, value 2).
 * Duplicated as a plain Int rather than imported so this file stays pure Kotlin with no
 * Android dependency, like the rest of `domain/`.
 */
const val FLAG_DEVICE_TO_DEVICE_TRANSFER = 2

/**
 * Whether a full-data backup pass should be allowed to write this device's data.
 *
 * A device-to-device transfer (moving to a new phone over USB or Wi-Fi, with no cloud
 * storage in between) is allowed even when [cloudBackupEnabled] is off, because the data
 * never reaches Google's servers — only cloud backup respects the switch. [transportFlags]
 * is 0 on API levels below 28, where the flag does not exist and every full backup is
 * therefore treated as a cloud backup.
 */
fun shouldRunFullBackup(cloudBackupEnabled: Boolean, transportFlags: Int): Boolean =
    cloudBackupEnabled || (transportFlags and FLAG_DEVICE_TO_DEVICE_TRANSFER) != 0
