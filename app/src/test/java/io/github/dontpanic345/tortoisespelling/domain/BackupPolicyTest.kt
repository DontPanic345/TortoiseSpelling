package io.github.dontpanic345.tortoisespelling.domain

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BackupPolicyTest {

    @Test
    fun `cloud backup on backs up regardless of transport`() {
        assertTrue(shouldRunFullBackup(cloudBackupEnabled = true, transportFlags = 0))
    }

    @Test
    fun `cloud backup off and no device-to-device flag skips the backup`() {
        assertFalse(shouldRunFullBackup(cloudBackupEnabled = false, transportFlags = 0))
    }

    @Test
    fun `device-to-device transfer runs even with cloud backup off`() {
        assertTrue(
            shouldRunFullBackup(
                cloudBackupEnabled = false,
                transportFlags = FLAG_DEVICE_TO_DEVICE_TRANSFER,
            ),
        )
    }

    @Test
    fun `device-to-device flag alongside unrelated bits still runs`() {
        val transportFlags = FLAG_DEVICE_TO_DEVICE_TRANSFER or 0b1000
        assertTrue(shouldRunFullBackup(cloudBackupEnabled = false, transportFlags = transportFlags))
    }

    @Test
    fun `unrelated transport flags alone do not run the backup`() {
        assertFalse(shouldRunFullBackup(cloudBackupEnabled = false, transportFlags = 0b1000))
    }
}
