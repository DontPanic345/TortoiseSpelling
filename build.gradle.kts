// AGP 9 has built-in Kotlin support, so org.jetbrains.kotlin.android is no longer applied;
// compose and serialization are separate compiler plugins and still need applying directly.
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.ksp) apply false
}
