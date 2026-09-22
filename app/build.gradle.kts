plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
}

android {
    namespace = "io.github.dontpanic345.tortoisespelling"
    // androidx.core 1.19.0 and androidx.compose.ui 1.12.1 (pulled in by the compose BOM
    // bump) require compiling against API 37; AGP 8.13's max recommended compileSdk was
    // 36, which is why this needed AGP 9 too.
    compileSdk = 37

    defaultConfig {
        applicationId = "io.github.dontpanic345.tortoisespelling"
        minSdk = 26
        targetSdk = 36
        versionCode = 3
        versionName = "0.2.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    // Release builds are signed from environment variables rather than a checked-in
    // keystore.properties, so the same build.gradle.kts works both for CI (which sets
    // them from GitHub Actions secrets) and for local release builds when needed. When
    // the env vars aren't set, the release build type is simply left unsigned.
    val releaseKeystorePath = System.getenv("RELEASE_KEYSTORE_PATH")
    signingConfigs {
        if (releaseKeystorePath != null) {
            create("release") {
                storeFile = file(releaseKeystorePath)
                storePassword = System.getenv("RELEASE_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("RELEASE_KEY_ALIAS")
                keyPassword = System.getenv("RELEASE_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            // R8 strips the unused bulk of material-icons-extended and the other
            // libraries. Every dependency here ships its own keep rules (Room, WorkManager,
            // kotlinx-serialization, OkHttp), so proguard-rules.pro starts empty.
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (releaseKeystorePath != null) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        // For BuildConfig.VERSION_NAME in Settings' About section.
        buildConfig = true
    }

    androidResources {
        // The app is English-only, so androidx's ~80 translations of its own strings
        // are dead weight in resources.arsc.
        localeFilters += "en"
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
            // Every androidx artifact ships the same Apache licence text.
            excludes += "/META-INF/**/LICENSE.txt"
        }
    }
}

// AGP 9's built-in Kotlin support (replacing the org.jetbrains.kotlin.android plugin)
// exposes compiler options through this top-level `kotlin` extension rather than
// android.kotlinOptions.
kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

// Room schemas are checked in so migrations can be written against a known history.
// Deliberately no fallbackToDestructiveMigration(): the word list is the one thing
// the user cannot recreate.
ksp {
    arg("room.schemaLocation", "$projectDir/schemas")
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.navigation.compose)

    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)

    implementation(libs.androidx.work.runtime.ktx)
    implementation(libs.okhttp)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.coroutines.android)

    debugImplementation(libs.androidx.compose.ui.tooling)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    // Android bundles org.json but stubs it in local unit tests; the real jar lets the
    // response-parsing logic be tested off-device.
    testImplementation(libs.json)
}
