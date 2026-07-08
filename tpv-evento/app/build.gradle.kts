plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.rdf.tpvevento"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.rdf.tpvevento"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    // The keystore is NOT committed. CI generates one per build (or restores
    // the user's own from a secret); locally you can create one with keytool.
    // Without a keystore, release builds fall back to the debug signing key.
    val releaseKeystore = file(
        System.getenv("TPV_KEYSTORE_FILE") ?: "$rootDir/keystore/release.keystore"
    )
    signingConfigs {
        create("release") {
            if (releaseKeystore.exists()) {
                storeFile = releaseKeystore
                storePassword = System.getenv("TPV_KEYSTORE_PASSWORD") ?: "tpvevento"
                keyAlias = System.getenv("TPV_KEY_ALIAS") ?: "tpv"
                keyPassword = System.getenv("TPV_KEY_PASSWORD") ?: "tpvevento"
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = if (releaseKeystore.exists()) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.09.03"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.activity:activity-compose:1.9.2")
    implementation("androidx.core:core-ktx:1.13.1")
}
