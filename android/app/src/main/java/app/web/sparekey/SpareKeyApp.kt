package app.web.sparekey

import android.app.Application
import app.web.sparekey.appcheck.BridgeAppCheckProviderFactory
import com.google.firebase.Firebase
import com.google.firebase.appcheck.appCheck
import com.google.firebase.initialize
import kotlinx.coroutines.flow.first

class SpareKeyApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Firebase.initialize(this)
        // App Check is enforced on Firebase AI Logic. A development build with a debug token in local.properties uses
        // Firebase's debug provider; every other build gets tokens from the site's reCAPTCHA Enterprise bridge, the
        // same way the Chrome extension does (an app installed from the site has no Play Integrity).
        Firebase.appCheck.installAppCheckProviderFactory(
            if (BuildConfig.DEBUG_APPCHECK) DevAppCheck.factory() else BridgeAppCheckProviderFactory(this))
    }

    /** Loads the App Check page ahead of the first cloud call. Does nothing on a build that uses a debug token. */
    fun warmAppCheck() { if (!BuildConfig.DEBUG_APPCHECK) app.web.sparekey.appcheck.Bridge.warm(this) }

    /** Waits until the site has handed over a token, at most `ms`. True when one is there. */
    suspend fun awaitAppCheck(ms: Long): Boolean {
        if (BuildConfig.DEBUG_APPCHECK) return true
        warmAppCheck()
        return kotlinx.coroutines.withTimeoutOrNull(ms) { app.web.sparekey.appcheck.Bridge.ready.first { it } } ?: false
    }

    val appCheckMode: String get() = if (BuildConfig.DEBUG_APPCHECK) "Debug token (development build)" else "reCAPTCHA Enterprise, through the site"
}
