package app.web.sparekey.engine

import android.content.Context
import androidx.javascriptengine.IsolateStartupParameters
import androidx.javascriptengine.JavaScriptIsolate
import androidx.javascriptengine.JavaScriptSandbox
import kotlinx.coroutines.guava.await
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONArray
import org.json.JSONObject

/**
 * The rules engine: the Chrome extension's own shared modules (shared/, bundled by build.mjs into assets/engine.js),
 * running in Jetpack's JavaScript sandbox, an isolated process with no network, no files and no access to the app.
 * Which apps become findings, the cloud gate (toCloud, checkOutgoing), the plan made by code and the nine safety rules
 * are the same code the extension and the website run and the tests cover; only reading the phone and the model calls
 * are Kotlin. Pattern reused from the author's Still Recalled entry.
 */
object Rules {
    private val lock = Mutex()
    private var sandbox: JavaScriptSandbox? = null
    private var isolate: JavaScriptIsolate? = null

    class Unsupported : Exception("This phone's Android System WebView is too old to run Spare Key's rules. Update it in Google Play.")

    suspend fun start(context: Context) = lock.withLock {
        if (isolate != null) return@withLock
        if (!JavaScriptSandbox.isSupported()) throw Unsupported()
        val box = JavaScriptSandbox.createConnectedInstanceAsync(context.applicationContext).await()
        val params = IsolateStartupParameters()
        if (box.isFeatureSupported(JavaScriptSandbox.JS_FEATURE_ISOLATE_MAX_HEAP_SIZE)) params.maxHeapSizeBytes = 128L shl 20
        val iso = box.createIsolate(params)
        iso.evaluateJavaScriptAsync(context.assets.open("engine.js").bufferedReader().use { it.readText() }).await()
        sandbox = box
        isolate = iso
    }

    /** Call `SK.<fn>` with JSON arguments (org.json values, strings, numbers, booleans or null). Returns its JSON. */
    suspend fun call(fn: String, vararg args: Any?): String = lock.withLock {
        val iso = isolate ?: error("rules engine not started")
        iso.evaluateJavaScriptAsync("SK.$fn(${args.joinToString(",") { lit(it) }})").await()
    }

    suspend fun obj(fn: String, vararg args: Any?) = JSONObject(call(fn, *args))
    suspend fun arr(fn: String, vararg args: Any?) = JSONArray(call(fn, *args))
    suspend fun str(fn: String, vararg args: Any?): String = JSONArray("[${call(fn, *args)}]").getString(0)

    /** A JavaScript literal for a value. org.json escapes U+2028 and U+2029, which JSON allows and old JavaScript didn't. */
    private fun lit(v: Any?): String = when (v) {
        null -> "null"
        is JSONObject, is JSONArray -> v.toString()
        is String -> JSONObject.quote(v)
        is Boolean, is Number -> v.toString()
        is Map<*, *> -> JSONObject(v).toString()
        is List<*> -> JSONArray(v).toString()
        else -> JSONObject.quote(v.toString())
    }
}
