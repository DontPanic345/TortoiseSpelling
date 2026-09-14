package com.falloon.tortoisespelling.data

import android.app.backup.BackupAgent
import android.app.backup.BackupDataInput
import android.app.backup.BackupDataOutput
import android.app.backup.FullBackupDataOutput
import android.content.Context
import android.os.Build
import android.os.ParcelFileDescriptor
import com.falloon.tortoisespelling.domain.shouldRunFullBackup

/**
 * Gates Android Auto Backup behind the "Back up to Google account" switch in Settings.
 *
 * Declared as `android:backupAgent` with `android:fullBackupOnly="true"`, so the system
 * routes every full-data backup pass through [onFullBackup] instead of the default
 * whole-app-directory copy. [onBackup] and [onRestore] are the key-value path, which
 * `fullBackupOnly` guarantees is never called; they are overridden only because
 * [BackupAgent] declares them abstract.
 *
 * During a backup pass Android starts the process in restricted mode and never creates
 * `TortoiseSpellingApp`, so its `AppContainer` does not exist yet. This agent therefore
 * reads the switch straight out of the same SharedPreferences file [SettingsStore]
 * writes to, rather than going through the app container.
 */
class TortoiseSpellingBackupAgent : BackupAgent() {

    override fun onFullBackup(data: FullBackupDataOutput) {
        // getTransportFlags() (and FLAG_DEVICE_TO_DEVICE_TRANSFER) were added in API 28;
        // below that every full backup is a cloud backup, so 0 (no flags) is correct.
        val transportFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            data.transportFlags
        } else {
            0
        }
        if (shouldRunFullBackup(cloudBackupEnabled(), transportFlags)) {
            super.onFullBackup(data)
        }
        // Otherwise: back up nothing. Not calling super.onFullBackup() at all means this
        // pass writes zero bytes, rather than writing an empty-but-present backup.
    }

    private fun cloudBackupEnabled(): Boolean =
        getSharedPreferences(SettingsStore.FILE, Context.MODE_PRIVATE)
            .getBoolean(SettingsStore.KEY_CLOUD_BACKUP_ENABLED, false)

    // --- key-value backup: unused, see the class doc above ---

    override fun onBackup(
        oldState: ParcelFileDescriptor?,
        data: BackupDataOutput?,
        newState: ParcelFileDescriptor?,
    ) = Unit

    override fun onRestore(
        data: BackupDataInput?,
        appVersionCode: Int,
        newState: ParcelFileDescriptor?,
    ) = Unit
}
