package app.web.sparekey.ai

import com.google.firebase.Firebase
import com.google.firebase.remoteconfig.remoteConfig
import com.google.firebase.remoteconfig.remoteConfigSettings
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Settings that change without an app update, from Firebase Remote Config: the same template the Chrome extension
 * reads (shared/config.js).
 *   cloud_models   cloud Gemini models, in order of preference
 *   cloud_on       off: no cloud step runs for anyone; the plan is made on the phone
 */
object LiveSettings {
    data class Values(val models: List<String>, val cloudOn: Boolean, val from: String)

    val DEFAULT_MODELS = listOf("gemini-3.5-flash-lite", "gemini-3.8-flash")

    private val lock = Mutex()
    private var cached: Values? = null
    private var cachedAt = 0L

    suspend fun get(): Values = lock.withLock {
        cached?.let { if (System.currentTimeMillis() - cachedAt < 600_000) return it }
        val rc = Firebase.remoteConfig
        val from = try {
            rc.setConfigSettingsAsync(remoteConfigSettings {
                minimumFetchIntervalInSeconds = 3600
                fetchTimeoutInSeconds = 5
            }).await()
            rc.setDefaultsAsync(mapOf("cloud_models" to DEFAULT_MODELS.joinToString(","), "cloud_on" to true)).await()
            if (withTimeoutOrNull(6000) { rc.fetchAndActivate().await() } != null) "remote" else "cached"
        } catch (e: Throwable) {
            "defaults"
        }
        val models = rc.getString("cloud_models").split(',').map { it.trim() }.filter { Regex("""^gemini-[\w.-]+$""").matches(it) }
        Values(
            models = models.ifEmpty { DEFAULT_MODELS },
            cloudOn = rc.getBoolean("cloud_on"),
            from = if (from == "cached" && rc.info.lastFetchStatus != com.google.firebase.remoteconfig.FirebaseRemoteConfig.LAST_FETCH_STATUS_SUCCESS) "defaults" else from,
        ).also { cached = it; cachedAt = System.currentTimeMillis() }
    }
}
