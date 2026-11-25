package app.web.sparekey.ai

import android.graphics.Bitmap
import com.google.firebase.Firebase
import com.google.firebase.ai.DownloadStatus
import com.google.firebase.ai.GenerativeModel
import com.google.firebase.ai.InferenceMode
import com.google.firebase.ai.InferenceSource
import com.google.firebase.ai.OnDeviceConfig
import com.google.firebase.ai.OnDeviceModelOption
import com.google.firebase.ai.OnDeviceModelStatus
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.FunctionDeclaration
import com.google.firebase.ai.type.FunctionResponsePart
import com.google.firebase.ai.type.GenerativeBackend
import com.google.firebase.ai.type.PublicPreviewAPI
import com.google.firebase.ai.type.RequestOptions
import com.google.firebase.ai.type.Schema
import com.google.firebase.ai.type.Tool
import com.google.firebase.ai.type.content
import com.google.firebase.ai.type.generationConfig
import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import org.json.JSONArray
import org.json.JSONObject

/**
 * Every model call in the app goes through Firebase AI Logic, here. Three ways of running, each where it fits:
 *
 *   DEVICE_ONLY      ONLY_ON_DEVICE: Gemini Nano on this phone (through AICore). Sorting the apps found on the phone,
 *                    and the plan when plan help from the cloud is off. The list of apps on someone's phone is private,
 *                    so this mode has no cloud fallback, on purpose.
 *   CLOUD_ONLY       ONLY_IN_CLOUD: the plan, ordered by Gemini in the cloud from finding codes only (shared toCloud),
 *                    with function calling: get_steps, ask_device (answered on the phone, yes / no / unknown) and
 *                    ask_user.
 *   ON_DEVICE_FIRST  PREFER_ON_DEVICE: kept for public text only, never for what the phone check read.
 *
 * The prompts and JSON schemas come from the shared rules engine (the same ones the extension uses). The cloud is
 * held to the schema with a response schema; on this phone the on-device path ignores response schemas, so the
 * schema also goes into the instructions and the answer is parsed with care.
 */
@OptIn(PublicPreviewAPI::class)
object Ai {
    enum class Mode { ON_DEVICE_FIRST, DEVICE_ONLY, CLOUD_ONLY }

    sealed interface Part
    data class Text(val text: String) : Part
    data class Image(val bitmap: Bitmap) : Part

    data class Prompt(val system: String, val schema: JSONObject)
    /** `cut` is true when the model's answer stopped partway and only the items it finished were kept. */
    data class Answer(val json: JSONObject, val onDevice: Boolean, val model: String, val cut: Boolean = false)

    private val ai by lazy { Firebase.ai(backend = GenerativeBackend.googleAI()) }
    private val options = RequestOptions(timeoutInMillis = 40_000)
    private val models = HashMap<String, GenerativeModel>()

    private fun model(prompt: Prompt, mode: Mode, cloudModel: String, maxOut: Int = 400): GenerativeModel {
        val key = "${mode.name}|$cloudModel|$maxOut|${deviceOption}|${prompt.system.hashCode()}"
        return synchronized(models) {
            models.getOrPut(key) {
                ai.generativeModel(
                    modelName = cloudModel,
                    generationConfig = generationConfig {
                        responseMimeType = "application/json"
                        responseSchema = toSchema(prompt.schema)
                        temperature = 0f
                    },
                    systemInstruction = content { text(prompt.system + "\n\n" + jsonInstruction(prompt.schema)) },
                    requestOptions = options,
                    onDeviceConfig = when (mode) {
                        Mode.ON_DEVICE_FIRST -> onDevice(InferenceMode.PREFER_ON_DEVICE, maxOut)
                        Mode.DEVICE_ONLY -> onDevice(InferenceMode.ONLY_ON_DEVICE, maxOut)
                        Mode.CLOUD_ONLY -> OnDeviceConfig(mode = InferenceMode.ONLY_IN_CLOUD)
                    },
                )
            }
        }
    }

    // Errors that mean "try the next model": busy or over quota, and a model that is no longer there (404).
    private val RETRYABLE = Regex("""\b(404|429|500|503|504)\b|NOT_FOUND|high demand|overloaded|RESOURCE_EXHAUSTED|UNAVAILABLE|timed? ?out|Timeout""", RegexOption.IGNORE_CASE)

    /**
     * One JSON answer. Tries the cloud models in order when one is busy; when all are over quota, waits and tries
     * again (twice).
     */
    suspend fun json(prompt: Prompt, parts: List<Part>, mode: Mode, cloudModels: List<String>, maxOut: Int = 400): Answer {
        var last: Throwable? = null
        for (attempt in 0..2) {
            for (name in cloudModels) {
                val started = System.currentTimeMillis()
                try {
                    val response = withTimeout(60_000) {
                        model(prompt, mode, name, maxOut).generateContent(content {
                            for (p in parts) when (p) {
                                is Text -> text(p.text)
                                is Image -> image(p.bitmap)
                            }
                        })
                    }
                    val onDevice = response.inferenceSource == InferenceSource.ON_DEVICE
                    android.util.Log.i("SpareKey", "model call: ${if (onDevice) "on device" else name}, ${System.currentTimeMillis() - started} ms")
                    val (parsed, cut) = parseOrSalvage(response.text ?: "")
                    if (cut) android.util.Log.i("SpareKey", "model answer was cut short; the finished items were kept")
                    return Answer(parsed, onDevice, if (onDevice) "Gemini Nano" else name, cut)
                } catch (e: Throwable) {
                    last = e
                    if (!RETRYABLE.containsMatchIn(e.toString()) && e !is kotlinx.coroutines.TimeoutCancellationException) throw e
                }
            }
            if (attempt < 2 && last != null && Regex("""\b429\b|RESOURCE_EXHAUSTED|quota""", RegexOption.IGNORE_CASE).containsMatchIn(last.toString())) delay(4000L shl attempt)
            else break
        }
        throw last ?: IllegalStateException("no model answered")
    }

    /**
     * A function the cloud model may call before it answers (Firebase AI Logic function calling). `declaration` is
     * the shared rules' JSON declaration (name, description, parameters); `run` answers a call on this phone.
     */
    class Function(val declaration: JSONObject, val run: suspend (JSONObject) -> JSONObject)

    private fun toolModel(prompt: Prompt, cloudModel: String, fns: List<Function>): GenerativeModel {
        val key = "TOOL|$cloudModel|${prompt.system.hashCode()}|${fns.joinToString(",") { it.declaration.getString("name") }}"
        return synchronized(models) {
            models.getOrPut(key) {
                val declarations = fns.map { fn ->
                    val params = fn.declaration.getJSONObject("parameters")
                    val props = params.getJSONObject("properties")
                    val required = params.optJSONArray("required") ?: JSONArray()
                    val req = (0 until required.length()).map { required.getString(it) }.toSet()
                    val map = LinkedHashMap<String, Schema>()
                    for (k in props.keys()) map[k] = toSchema(props.getJSONObject(k))
                    FunctionDeclaration(fn.declaration.getString("name"), fn.declaration.getString("description"), map, map.keys.filter { it !in req })
                }
                ai.generativeModel(
                    modelName = cloudModel,
                    generationConfig = generationConfig {
                        responseMimeType = "application/json"
                        responseSchema = toSchema(prompt.schema)
                        temperature = 0f
                    },
                    tools = listOf(Tool.functionDeclarations(declarations)),
                    systemInstruction = content { text(prompt.system + "\n\n" + jsonInstruction(prompt.schema)) },
                    requestOptions = options,
                    onDeviceConfig = OnDeviceConfig(mode = InferenceMode.ONLY_IN_CLOUD),
                )
            }
        }
    }

    /**
     * One JSON answer from the cloud (ONLY_IN_CLOUD), which may first call `fn`. The call comes back to the phone,
     * `fn.run` answers it here, and the model then gives its answer. At most two rounds of calls.
     */
    suspend fun jsonWithFunctions(prompt: Prompt, parts: List<Part>, cloudModels: List<String>, fns: List<Function>): Answer {
        val byName = fns.associateBy { it.declaration.getString("name") }
        var last: Throwable? = null
        for (attempt in 0..2) {
            for (name in cloudModels) {
                val started = System.currentTimeMillis()
                try {
                    val text = withTimeout(90_000) {
                        val chat = toolModel(prompt, name, fns).startChat()
                        var response = chat.sendMessage(content {
                            for (p in parts) when (p) {
                                is Text -> text(p.text)
                                is Image -> image(p.bitmap)
                            }
                        })
                        var round = 0
                        while (response.functionCalls.isNotEmpty() && round < 3) {
                            val answers = response.functionCalls.take(4).map { call ->
                                val args = JSONObject()
                                for ((k, v) in call.args) args.put(k, (v as? JsonPrimitive)?.content ?: JSONTokenerValue(v.toString()))
                                val fn = byName[call.name]
                                val result = if (round < 2 && fn != null) fn.run(args) else JSONObject().put("note", if (fn == null) "Unknown function." else "No more lookups. Answer now.")
                                FunctionResponsePart(call.name, Json.parseToJsonElement(result.toString()).jsonObject)
                            }
                            android.util.Log.i("SpareKey", "function call: ${response.functionCalls.first().name}, answered on this phone")
                            // The Gemini Developer API takes function answers in a "user" turn ("function" is refused there).
                            response = chat.sendMessage(content("user") { for (a in answers) part(a) })
                            round++
                        }
                        response.text ?: ""
                    }
                    android.util.Log.i("SpareKey", "model call: $name, ${System.currentTimeMillis() - started} ms")
                    // A model that keeps calling the function after being told to answer leaves no text: ask once
                    // more without it.
                    if (!text.contains('{')) return json(prompt, parts, Mode.CLOUD_ONLY, listOf(name))
                    return Answer(parseJson(text), false, name)
                } catch (e: Throwable) {
                    last = e
                    if (!RETRYABLE.containsMatchIn(e.toString()) && e !is kotlinx.coroutines.TimeoutCancellationException) throw e
                }
            }
            if (attempt < 2 && last != null && Regex("""\b429\b|RESOURCE_EXHAUSTED|quota""", RegexOption.IGNORE_CASE).containsMatchIn(last.toString())) delay(4000L shl attempt)
            else break
        }
        throw last ?: IllegalStateException("no model answered")
    }

    /** org.json values as plain Kotlin maps and lists, the way a template's variables are sent. */
    private fun plain(v: Any?): Any? = when (v) {
        is JSONObject -> v.keys().asSequence().associateWith { plain(v.get(it)) }
        is JSONArray -> (0 until v.length()).map { plain(v.get(it)) }
        JSONObject.NULL -> null
        else -> v
    }

    /**
     * The cloud plan through a Firebase AI Logic server prompt template: the instructions, answer format and functions
     * live on Firebase's server (shared/plan/template.js); the phone sends the template's id and `vars` (the codes and
     * chosen answers), which the server checks again against the template's input schema. Templates are tried in order.
     */
    suspend fun templateJsonWithFunctions(templateIds: List<String>, vars: JSONObject, fns: List<Function>): Answer {
        val byName = fns.associateBy { it.declaration.getString("name") }
        @Suppress("UNCHECKED_CAST") val variables = plain(vars) as Map<String, Any?>
        var last: Throwable? = null
        for (id in templateIds) {
            val started = System.currentTimeMillis()
            try {
                val text = withTimeout(90_000) {
                    val chat = ai.templateGenerativeModel(options).startChat(id, variables.filterValues { it != null } as Map<String, Any>, emptyList())
                    var response = chat.sendMessage("Order the plan.")
                    var round = 0
                    while (response.functionCalls.isNotEmpty() && round < 3) {
                        val answers = response.functionCalls.take(4).map { call ->
                            val args = JSONObject()
                            for ((k, v) in call.args) args.put(k, (v as? JsonPrimitive)?.content ?: JSONTokenerValue(v.toString()))
                            val fn = byName[call.name]
                            val result = if (round < 2 && fn != null) fn.run(args) else JSONObject().put("note", if (fn == null) "Unknown function." else "No more lookups. Answer now.")
                            FunctionResponsePart(call.name, Json.parseToJsonElement(result.toString()).jsonObject)
                        }
                        android.util.Log.i("SpareKey", "template function call: ${response.functionCalls.first().name}, answered on this phone")
                        response = chat.sendMessage(content("user") { for (a in answers) part(a) })
                        round++
                    }
                    response.text ?: ""
                }
                android.util.Log.i("SpareKey", "template call: $id, ${System.currentTimeMillis() - started} ms")
                return Answer(parseJson(text), false, "template $id")
            } catch (e: Throwable) {
                if (e is kotlinx.coroutines.CancellationException && e !is kotlinx.coroutines.TimeoutCancellationException) throw e
                android.util.Log.w("SpareKey", "template $id: ${e.javaClass.simpleName}: ${e.message?.take(200)}")
                last = e
            }
        }
        throw last ?: IllegalStateException("no template answered")
    }

    /** A function argument that is an array or object (get_steps' list of codes) as org.json, so the rules can read it. */
    private fun JSONTokenerValue(text: String): Any = try { org.json.JSONTokener(text).nextValue() } catch (e: Exception) { text }

    /**
     * A small model on the phone can run out of room and stop in the middle of a list. Then the items it finished are
     * kept: the text is cut after the last complete item of the first list and closed. Returns the object and whether
     * it had to be cut. What is missing is for the caller to make up (the plan's safety rules add every finding a
     * model left out).
     */
    fun parseOrSalvage(text: String): Pair<JSONObject, Boolean> {
        try { return parseJson(text) to false } catch (_: Exception) {}
        val start = text.indexOf('{')
        require(start >= 0) { "no JSON in the answer" }
        var depth = 0; var inString = false; var escaped = false; var lastItem = -1
        for (i in start until text.length) {
            val c = text[i]
            if (inString) { if (escaped) escaped = false else if (c == '\\') escaped = true else if (c == '"') inString = false; continue }
            when (c) {
                '"' -> inString = true
                '{', '[' -> depth++
                '}', ']' -> { depth--; if (depth == 2 && c == '}') lastItem = i }
            }
        }
        require(lastItem > 0) { "no complete item in the answer" }
        return JSONObject(text.substring(start, lastItem + 1) + "]}") to true
    }

    /** The answer's JSON object, also when a model wraps it in a code fence or adds a sentence. */
    fun parseJson(text: String): JSONObject {
        val start = text.indexOf('{')
        val end = text.lastIndexOf('}')
        require(start >= 0 && end > start) { "no JSON in the answer" }
        return JSONObject(text.substring(start, end + 1))
    }

    private fun jsonInstruction(schema: JSONObject) =
        "Reply with only one JSON object and no other text. It must follow this JSON Schema exactly: $schema"

    /** A JSON Schema from the shared prompts, as Firebase AI Logic's response schema. */
    fun toSchema(s: JSONObject): Schema {
        val description = s.optString("description").ifEmpty { null }
        if (s.has("enum")) {
            val values = s.getJSONArray("enum")
            return Schema.enumeration((0 until values.length()).map { values.getString(it) }, description)
        }
        return when (s.optString("type")) {
            "object" -> {
                val props = s.optJSONObject("properties") ?: JSONObject()
                val required = s.optJSONArray("required") ?: JSONArray()
                val req = (0 until required.length()).map { required.getString(it) }.toSet()
                val map = LinkedHashMap<String, Schema>()
                for (k in props.keys()) map[k] = toSchema(props.getJSONObject(k))
                Schema.obj(map, optionalProperties = map.keys.filter { it !in req }, description = description)
            }
            "array" -> Schema.array(toSchema(s.optJSONObject("items") ?: JSONObject().put("type", "string")), description)
            "boolean" -> Schema.boolean(description)
            "integer" -> Schema.integer(description)
            "number" -> Schema.double(description)
            else -> Schema.string(description)
        }
    }

    // ---- The on-device model ---------------------------------------------------------------------------------------
    // Which on-device model, in order of preference, from Remote Config (device_models): "preview" is Gemini Nano 4
    // Full and "preview_fast" Gemini Nano 4 Fast (both built on Gemma 4; a phone needs the AICore developer preview for
    // them today), "stable" the Gemini Nano a phone ships with. The first one this phone has is used; the next ones are
    // the backups. Null means the SDK's default.
    @Volatile var deviceOption: OnDeviceModelOption? = null
        private set
    @Volatile var deviceOptionName = "default"
        private set
    private val OPTIONS = mapOf("preview" to OnDeviceModelOption.PREVIEW, "preview_fast" to OnDeviceModelOption.PREVIEW_FAST, "stable" to OnDeviceModelOption.STABLE)

    private fun onDevice(mode: InferenceMode, maxOut: Int) =
        deviceOption?.let { OnDeviceConfig(mode = mode, maxOutputTokens = maxOut, temperature = 0f, modelOption = it) }
            ?: OnDeviceConfig(mode = mode, maxOutputTokens = maxOut, temperature = 0f)

    private val probes = HashMap<String, GenerativeModel>()
    private fun probeFor(name: String): GenerativeModel = synchronized(probes) {
        probes.getOrPut(name) {
            val opt = OPTIONS[name]
            ai.generativeModel(modelName = "gemini-3.5-flash-lite", onDeviceConfig = opt?.let { OnDeviceConfig(mode = InferenceMode.PREFER_ON_DEVICE, modelOption = it) } ?: OnDeviceConfig(mode = InferenceMode.PREFER_ON_DEVICE))
        }
    }
    private val probe get() = probeFor(deviceOptionName)

    /** One tiny question, on the device only, to see that a model really answers before every call is sent to it. */
    private suspend fun answers(name: String): Boolean = try {
        withTimeout(20_000) {
            val m = ai.generativeModel(modelName = "gemini-3.5-flash-lite",
                onDeviceConfig = OnDeviceConfig(mode = InferenceMode.ONLY_ON_DEVICE, maxOutputTokens = 8, temperature = 0f, modelOption = OPTIONS.getValue(name)))
            m.generateContent("Reply with the word OK.").inferenceSource == InferenceSource.ON_DEVICE
        }
    } catch (e: Throwable) {
        android.util.Log.w("SpareKey", "on-device model $name did not answer: ${e.javaClass.simpleName}: ${e.message?.take(200)}")
        false
    }

    private suspend fun statusOf(name: String): String = try {
        when (probeFor(name).onDeviceExtension?.checkStatus()) {
            OnDeviceModelStatus.AVAILABLE -> "available"
            OnDeviceModelStatus.DOWNLOADABLE -> "downloadable"
            OnDeviceModelStatus.DOWNLOADING -> "downloading"
            else -> "unavailable"
        }
    } catch (e: Throwable) {
        "unavailable"
    }

    /**
     * "available", "downloadable", "downloading" or "unavailable", for the first model in `order` this phone has, which
     * then becomes the one every on-device call uses. `tried` gets each model's status, for Under the hood.
     */
    suspend fun deviceStatus(order: List<String> = listOf("stable"), tried: (String, String) -> Unit = { _, _ -> }): String {
        val names = order.filter { it in OPTIONS }.ifEmpty { listOf("stable") }
        val seen = names.map { it to statusOf(it) }
        // "Available" is what AICore reports; a model that is still being fetched in the background can report it and
        // then fail every call. So each available model is asked one tiny question on the device before it is used,
        // and the next one is tried when it does not answer. The question names no one.
        var pick: Pair<String, String>? = null
        for ((name, status) in seen) {
            if (pick == null && status == "available") {
                if (answers(name)) { tried(name, "available, answered"); pick = name to status; continue }
                tried(name, "available, did not answer"); continue
            }
            tried(name, status)
        }
        pick = pick ?: seen.firstOrNull { it.second == "downloading" } ?: seen.firstOrNull { it.second == "downloadable" }
        if (pick != null) { deviceOptionName = pick.first; deviceOption = OPTIONS[pick.first]; synchronized(models) { models.clear() } }
        return pick?.second ?: "unavailable"
    }

    /**
     * Asks Android to download Gemini Nano. Calls `progress(bytes so far, bytes in all)` as it goes; returns null when
     * it is done, or a short reason when it failed.
     */
    suspend fun download(progress: (Long, Long) -> Unit): String? {
        val flow = probe.onDeviceExtension?.download() ?: return "not offered on this phone"
        var total = 0L
        var failed: String? = null
        try {
            flow.collect { s ->
                when (s) {
                    is DownloadStatus.DownloadStarted -> { total = s.bytesToDownload; progress(0, total) }
                    is DownloadStatus.DownloadInProgress -> progress(s.totalBytesDownloaded, total)
                    is DownloadStatus.DownloadFailed -> failed = s.exception.message?.take(160) ?: "the download failed"
                    else -> progress(total, total)
                }
            }
        } catch (e: Throwable) {
            failed = "${e.javaClass.simpleName}: ${e.message?.take(160)}"
        }
        return failed
    }

    suspend fun deviceModelName(): String = try { probe.onDeviceExtension?.getModelName() ?: "" } catch (e: Throwable) { "" }

    suspend fun warmUp() { try { probe.onDeviceExtension?.warmUp() } catch (_: Throwable) {} }
}
