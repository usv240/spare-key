package app.web.sparekey.engine

import android.annotation.SuppressLint
import android.content.Context
import android.webkit.WebView
import androidx.javascriptengine.IsolateStartupParameters
import androidx.javascriptengine.JavaScriptIsolate
import androidx.javascriptengine.JavaScriptSandbox
import app.web.sparekey.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.guava.await
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import kotlin.coroutines.resume

/**
 * The rules engine: the Chrome extension's own shared modules (shared/, bundled by build.mjs into assets/engine.js),
 * running in Jetpack's JavaScript sandbox, an isolated process with no network, no files and no access to the app.
 * Which apps become findings, the cloud gate (toCloud, checkOutgoing), the plan made by code and the eleven safety rules
 * are the same code the extension and the website run and the tests cover; only reading the phone and the model calls
 * are Kotlin. Pattern reused from the author's Still Recalled entry.
 *
 * Backup: if the sandbox cannot start (an old Android System WebView, or the sandbox service fails), the same
 * engine.js runs in a hidden WebView with network loads, file access and content access turned off. The app says which
 * one is in use. A debug build can be told to use the backup, for testing, with a file named force-webview-rules in
 * the app's files folder.
 */
object Rules {
    private val lock = Mutex()
    private var sandbox: JavaScriptSandbox? = null
    private var isolate: JavaScriptIsolate? = null
    private var web: WebView? = null

    /** "sandbox" or "webview": where the rules run. */
    var engine: String = "none"
        private set
    /** Why the sandbox was not used, when the backup is in use. */
    var sandboxError: String? = null
        private set

    class Unsupported : Exception("This phone's Android System WebView is too old to run Spare Key's rules. Update it in Google Play.")

    suspend fun start(context: Context) = lock.withLock {
        if (isolate != null || web != null) return@withLock
        val code = context.assets.open("engine.js").bufferedReader().use { it.readText() }
        val forced = BuildConfig.DEBUG && File(context.filesDir, "force-webview-rules").exists()
        try {
            if (forced) throw IllegalStateException("backup asked for by the test")
            if (!JavaScriptSandbox.isSupported()) throw Unsupported()
            val box = JavaScriptSandbox.createConnectedInstanceAsync(context.applicationContext).await()
            val params = IsolateStartupParameters()
            if (box.isFeatureSupported(JavaScriptSandbox.JS_FEATURE_ISOLATE_MAX_HEAP_SIZE)) params.maxHeapSizeBytes = 128L shl 20
            val iso = box.createIsolate(params)
            iso.evaluateJavaScriptAsync(code).await()
            sandbox = box
            isolate = iso
            engine = "sandbox"
        } catch (e: Throwable) {
            sandboxError = "${e.javaClass.simpleName}: ${e.message?.take(160)}"
            android.util.Log.w("SpareKey", "rules: sandbox did not start ($sandboxError); using the WebView backup")
            startWebView(context, code)
            engine = "webview"
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private suspend fun startWebView(context: Context, code: String) = withContext(Dispatchers.Main) {
        val v = WebView(context.applicationContext)
        v.settings.apply {
            javaScriptEnabled = true
            blockNetworkLoads = true
            blockNetworkImage = true
            allowFileAccess = false
            allowContentAccess = false
            domStorageEnabled = false
            setGeolocationEnabled(false)
        }
        // An empty page with no origin to reach; the engine never fetches anything.
        suspendCancellableCoroutine { done ->
            v.webViewClient = object : android.webkit.WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) { if (done.isActive) done.resume(Unit) }
            }
            v.loadDataWithBaseURL(null, "<!doctype html><title>rules</title>", "text/html", "utf-8", null)
        }
        evalIn(v, "$code\n;typeof SK")
        web = v
    }

    /** evaluateJavascript gives the result as JSON; the sandbox gives it as a plain string. This returns the plain string. */
    private suspend fun evalIn(v: WebView, js: String): String = withContext(Dispatchers.Main) {
        suspendCancellableCoroutine { done ->
            v.evaluateJavascript(js) { r ->
                val plain = if (r == null || r == "null") "null" else try { JSONArray("[$r]").get(0).toString() } catch (_: Throwable) { r }
                done.resume(plain)
            }
        }
    }

    /** Call `SK.<fn>` with JSON arguments (org.json values, strings, numbers, booleans or null). Returns its JSON. */
    suspend fun call(fn: String, vararg args: Any?): String = lock.withLock {
        val js = "SK.$fn(${args.joinToString(",") { lit(it) }})"
        isolate?.let { return@withLock it.evaluateJavaScriptAsync(js).await() }
        val v = web ?: error("rules engine not started")
        evalIn(v, js)
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
