package io.github.dontpanic345.tortoisespelling.data

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * AES-GCM encryption backed by a key that never leaves the Android keystore.
 *
 * This replaces androidx.security:security-crypto (EncryptedSharedPreferences), which
 * reached 1.1.0 stable but is deprecated with no successor — not something to start a
 * new app on. The scope here is small enough to own outright: one key, one algorithm,
 * used for one secret.
 */
internal object SecretCipher {

    private const val KEYSTORE = "AndroidKeyStore"
    private const val KEY_ALIAS = "tortoisespelling.settings.v1"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val IV_LENGTH = 12
    private const val TAG_LENGTH_BITS = 128

    /** Marks a value this app wrote, so a plaintext leftover is never fed to the cipher. */
    private const val PREFIX = "v1:"

    fun encrypt(plainText: String): String {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, secretKey())
        val cipherText = cipher.doFinal(plainText.toByteArray(Charsets.UTF_8))
        return PREFIX + Base64.encodeToString(cipher.iv + cipherText, Base64.NO_WRAP)
    }

    /**
     * Returns null when the stored value cannot be read — most plausibly because the
     * keystore entry was invalidated by a device restore. Callers treat that as "no key
     * saved" and ask for it again, which is a far better outcome than crashing.
     */
    fun decrypt(stored: String): String? {
        if (!stored.startsWith(PREFIX)) {
            return null
        }
        return try {
            val raw = Base64.decode(stored.removePrefix(PREFIX), Base64.NO_WRAP)
            if (raw.size <= IV_LENGTH) {
                return null
            }
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(
                Cipher.DECRYPT_MODE,
                secretKey(),
                GCMParameterSpec(TAG_LENGTH_BITS, raw, 0, IV_LENGTH),
            )
            String(cipher.doFinal(raw, IV_LENGTH, raw.size - IV_LENGTH), Charsets.UTF_8)
        } catch (error: Exception) {
            null
        }
    }

    private fun secretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        (keyStore.getEntry(KEY_ALIAS, null) as? KeyStore.SecretKeyEntry)?.let {
            return it.secretKey
        }

        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
        generator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                // Deliberately not setUserAuthenticationRequired: a daily habit app that
                // demands a biometric prompt to look a word up would not get opened.
                .build(),
        )
        return generator.generateKey()
    }
}
