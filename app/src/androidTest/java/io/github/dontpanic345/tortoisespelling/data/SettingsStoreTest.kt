package io.github.dontpanic345.tortoisespelling.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.core.content.edit
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.security.KeyStore
import javax.crypto.KeyGenerator

@RunWith(AndroidJUnit4::class)
class SettingsStoreTest {

    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val prefs = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
    private val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

    @Before
    fun clean() = wipe()

    @After
    fun wipeAfter() = wipe()

    private fun wipe() {
        prefs.edit { clear() }
        runCatching { keyStore.deleteEntry(ALIAS) }
    }

    private fun createLegacyKey() {
        KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(
                KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .build(),
            )
        }.generateKey()
    }

    @Test
    fun anApiKeySavedByAnEarlierVersionIsDeletedWithItsKeystoreKey() {
        prefs.edit {
            putString("apiKey", "v1:abc")
            putInt("newWordsPerDay", 7)
        }
        createLegacyKey()
        assertTrue(keyStore.containsAlias(ALIAS))

        val store = SettingsStore(context, FILE)

        assertFalse(prefs.contains("apiKey"))
        assertEquals(7, store.current().newWordsPerDay)
        assertFalse(keyStore.containsAlias(ALIAS))
    }

    @Test
    fun withNoApiKeyConstructionChangesNothing() {
        prefs.edit { putInt("newWordsPerDay", 7) }
        createLegacyKey()
        val before = prefs.all

        SettingsStore(context, FILE)

        assertEquals(before, prefs.all)
        assertTrue(keyStore.containsAlias(ALIAS))
    }

    private companion object {
        const val FILE = "settings-store-test"
        const val ALIAS = "tortoisespelling.settings.v1"
    }
}
