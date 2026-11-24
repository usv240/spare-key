// A test app for the emulator only, never shipped: it holds the kinds of access a phone-watching app asks for
// (accessibility, device admin, notification access, location all the time, texts), so the phone check has something
// real to find. tools/android-e2e.mjs installs it, turns each access on through adb, runs Spare Key, then removes it.
plugins {
    id("com.android.application")
}

android {
    namespace = "com.example.planted"
    compileSdk {
        version = release(37) { minorApiLevel = 2 }
    }
    defaultConfig {
        applicationId = "com.example.planted"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
