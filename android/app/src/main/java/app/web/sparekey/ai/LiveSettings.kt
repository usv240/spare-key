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
 *   plan_templates the server prompt templates the plan is asked through, in order (empty: the direct call only)
 *   device_models  on-device models in order: preview (Gemini Nano 4 Full), preview_fast (Gemini Nano 4 Fast), stable
 */
object LiveSettings {
    data class Values(val models: List<String>, val cloudOn: Boolean, val from: String, val templates: List<String> = DEFAULT_TEMPLATES, val deviceModels: List<String> = DEFAULT_DEVICE_MODELS)

    val DEFAULT_MODELS = listOf("gemini-3.5-flash-lite", "gemini-3.8-flash")
    val DEFAULT_TEMPLATES = listOf("spare-key-plan-v1", "spare-key-plan-b-v1")
    val DEFAULT_DEVICE_MODELS = listOf("preview_fast", "preview", "stable")
    private fun list(s: String, ok: Regex) = s.split(',').map { it.trim() }.filter { ok.matches(it) }

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
            rc.setDefaultsAsync(mapOf("cloud_models" to DEFAULT_MODELS.joinToString(","), "cloud_on" to true, "plan_templates" to DEFAULT_TEMPLATES.joinToString(","), "device_models" to DEFAULT_DEVICE_MODELS.joinToString(","))).await()
            if (withTimeoutOrNull(6000) { rc.fetchAndActivate().await() } != null) "remote" else "cached"
        } catch (e: Throwable) {
            "defaults"
        }
        val models = rc.getString("cloud_models").split(',').map { it.trim() }.filter { Regex("""^gemini-[\w.-]+$""").matches(it) }
        Values(
            models = models.ifEmpty { DEFAULT_MODELS },
            cloudOn = rc.getBoolean("cloud_on"),
            templates = list(rc.getString("plan_templates"), Regex("""^[a-z][a-z0-9-]{0,62}$""")),
            deviceModels = list(rc.getString("device_models"), Regex("""^(preview|preview_fast|stable)$""")).ifEmpty { DEFAULT_DEVICE_MODELS },
            from = if (from == "cached" && rc.info.lastFetchStatus != com.google.firebase.remoteconfig.FirebaseRemoteConfig.LAST_FETCH_STATUS_SUCCESS) "defaults" else from,
        ).also { cached = it; cachedAt = System.currentTimeMillis() }
    }
}
