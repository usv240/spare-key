package app.web.sparekey.ui

import android.app.Application
import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.web.sparekey.ai.Ai
import app.web.sparekey.ai.LiveSettings
import app.web.sparekey.engine.Rules
import app.web.sparekey.phone.PhoneScan
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONArray
import org.json.JSONObject
import java.text.DateFormat
import java.util.Date

/**
 * The phone check, start to finish. Reading the phone happens here (PhoneScan); every decision is made by the shared
 * rules in the sandbox (Rules, assets/engine.js); every model call goes through Firebase AI Logic (Ai). Nothing from
 * the check is written to storage: it lives in memory, and Quick exit or closing the app forgets it.
 */
class AppModel(app: Application) : AndroidViewModel(app) {
    sealed interface Screen
    data object Safety : Screen
    data class Checking(val line: String, val done: Int, val total: Int) : Screen
    data object Results : Screen
    data object Plan : Screen
    data object Hood : Screen

    private val prefs = app.getSharedPreferences("settings", Context.MODE_PRIVATE)

    var screen by mutableStateOf<Screen>(Safety)
        private set
    var practice by mutableStateOf(false)
        private set
    var ready by mutableStateOf(false)
        private set
    var startError by mutableStateOf<String?>(null)
        private set
    /** Gemini Nano on this phone: "available", "downloadable", "downloading" or "unavailable". */
    var nano by mutableStateOf("unavailable")
        private set
    /** The person's own switch for plan help from the cloud. The only setting the app keeps. */
    var cloudOn by mutableStateOf(prefs.getBoolean("cloud", true))
        private set
    var rcFrom by mutableStateOf("")
        private set

    var library by mutableStateOf(JSONObject())
        private set
    var findings by mutableStateOf<List<JSONObject>>(emptyList())
        private set
    var notRead by mutableStateOf<List<String>>(emptyList())
        private set
    var appsSeen by mutableStateOf(0)
        private set
    var nanoSorted by mutableStateOf(0)
        private set
    /** Apps that came with the phone and hold some of these powers: counted, not listed (shared/phone.js). */
    var builtIn by mutableStateOf(0)
        private set
    var checkedAt by mutableStateOf("")
        private set
    val ownership = mutableStateMapOf<String, String>()
    val revealed = mutableStateMapOf<String, Boolean>()

    // The plan.
    var situation by mutableStateOf(JSONObject())
        private set
    var plan by mutableStateOf<JSONObject?>(null)
        private set
    var planSource by mutableStateOf("")
        private set
    var planNote by mutableStateOf("")
        private set
    var planBusy by mutableStateOf(false)
        private set
    var deviceAnswers by mutableStateOf(0)
        private set
    /** A question from the cloud plan for the person (ask_user), waiting for an answer. */
    var asking by mutableStateOf<Pair<String, CompletableDeferred<String>>?>(null)
        private set

    /** One thing sent to the cloud: what it was, in a sentence, and the exact text. */
    data class Sent(val what: String, val summary: String, val text: String)
    /** Everything sent to the cloud from this phone, word for word, for "What left this phone". */
    val ledger = mutableStateListOf<Sent>()
    /**
     * What Spare Key did, step by step, with how long each step took: for "Under the hood". It stays in memory on this
     * phone and is forgotten with the check. No app's name goes in it. Spare Key sends no usage or crash reports.
     */
    val log = mutableStateListOf<String>()
    private fun note(line: String) { log += "${DateFormat.getTimeInstance(DateFormat.MEDIUM).format(Date())}  $line" }
    private fun secs(since: Long) = "%.1f s".format((System.currentTimeMillis() - since) / 1000.0)
    /** The person can stop Gemini Nano's sorting and see the results as they are. */
    private var skipSorting = false
    fun showResultsNow() { skipSorting = true }

    init {
        viewModelScope.launch {
            val t = System.currentTimeMillis()
            try {
                Rules.start(getApplication())
                library = Rules.obj("library")
                ready = true
                note("Rules started in the sandbox in ${secs(t)}. Steps library version ${library.optInt("version")}.")
            } catch (e: Throwable) {
                android.util.Log.w("SpareKey", "rules: ${e.javaClass.simpleName}: ${e.message?.take(300)}")
                startError = "Spare Key's rules could not start on this phone. Update Android System WebView in the Play Store, then open Spare Key again."
                note("Rules did not start: ${e.javaClass.simpleName}.")
            }
            nano = Ai.deviceStatus()
            note("Gemini Nano on this phone: $nano.")
            if (nano == "available") Ai.warmUp()
            rcFrom = try { LiveSettings.get().from } catch (_: Throwable) { "defaults" }
        }
    }

    fun setCloud(on: Boolean) { cloudOn = on; prefs.edit().putBoolean("cloud", on).apply() }
    fun show(s: Screen) { screen = s }

    // ---- The check ------------------------------------------------------------------------------------------------
    fun check(practiceRun: Boolean) {
        if (!ready) return
        practice = practiceRun
        ownership.clear(); revealed.clear(); plan = null; planNote = ""; ledger.clear()
        skipSorting = false
        // Plan help from the cloud needs an App Check token, which a slow phone can take 20 s to get. Start now, so it
        // is ready by the time the person asks for a plan. Not for a practice check, which never calls the cloud.
        if (cloudOn && !practiceRun) (getApplication<Application>() as? app.web.sparekey.SpareKeyApp)?.warmAppCheck()
        screen = Checking("Reading this phone's settings", 0, 1)
        viewModelScope.launch {
            val t0 = System.currentTimeMillis()
            val (facts, missed) = if (practiceRun) JSONObject(Rules.call("practiceFacts")) to emptyList()
            else withContext(Dispatchers.Default) { PhoneScan.read(getApplication()).let { it.facts to it.notRead } }
            val apps = facts.optJSONArray("apps") ?: JSONArray()
            appsSeen = apps.length()
            // Gemini Nano on this phone says what kind of app each one seems to be. ONLY_ON_DEVICE: the list of apps on
            // a phone is private, so there is no cloud fallback. It can add a note and a kind, never hide a finding.
            val kinds = JSONObject()
            nanoSorted = 0
            if (nano == "available") {
                val prompt = Rules.obj("appKindPrompt")
                val toSort = (0 until apps.length()).map { apps.getJSONObject(it) }.filter { !it.optBoolean("system") }.take(30)
                val tn = System.currentTimeMillis()
                for ((i, a) in toSort.withIndex()) {
                    if (skipSorting) break
                    screen = Checking("Gemini Nano is sorting the apps, on this phone", i, toSort.size)
                    val answer = withTimeoutOrNull(20_000) {
                        try {
                            Ai.json(Ai.Prompt(prompt.getString("system"), prompt.getJSONObject("schema")),
                                listOf(Ai.Text(Rules.str("appKindText", a))), Ai.Mode.DEVICE_ONLY, LiveSettings.DEFAULT_MODELS)
                        } catch (e: Throwable) { null }
                    }
                    if (answer != null && answer.onDevice) {
                        kinds.put(a.getString("pkg"), Rules.obj("appKindFrom", answer.json))
                        nanoSorted++
                    }
                }
                note("Gemini Nano sorted $nanoSorted of ${toSort.size} apps on this phone in ${secs(tn)}" + (if (skipSorting) ", stopped early by you." else "."))
            }
            screen = Checking("Sorting what was found", 1, 1)
            val result = Rules.obj("findings", facts, kinds)
            val list = result.getJSONArray("findings")
            findings = (0 until list.length()).map { list.getJSONObject(it) }
            builtIn = result.optInt("builtIn")
            notRead = missed
            checkedAt = DateFormat.getDateTimeInstance(DateFormat.LONG, DateFormat.SHORT).format(Date())
            note((if (practiceRun) "Practice check" else "Check") + " finished in ${secs(t0)}: ${apps.length()} apps with special access read, ${findings.size} listed, $builtIn that came with the phone not listed" +
                (if (missed.isNotEmpty()) ", ${missed.distinct().size} thing not readable." else "."))
            screen = Results
        }
    }

    fun answer(ref: String, value: String?) {
        if (value == null) ownership.remove(ref) else ownership[ref] = value
        viewModelScope.launch { Rules.call("setOwnership", ref, value) }
    }

    // ---- The plan -------------------------------------------------------------------------------------------------
    fun setSituation(key: String, value: String) { situation = JSONObject(situation.toString()).put(key, value) }

    private fun notChecked(): JSONArray = JSONArray(notRead.distinct())

    fun makePlan() {
        if (planBusy) return
        planBusy = true
        deviceAnswers = 0
        screen = Plan
        viewModelScope.launch {
            // 1. The plan made by code, at once. It is what the person sees if no model answers.
            val code = Rules.obj("codePlan", situation, notChecked())
            plan = code.getJSONObject("plan"); planSource = "code"
            note("Plan made by code on this phone: ${plan?.optJSONArray("actions")?.length() ?: 0} steps.")
            val settings = try { LiveSettings.get() } catch (_: Throwable) { null }
            val shared = JSONObject().put("safe_to_change_now", true).put("has_advocate", true)
            val cloud = cloudOn && settings?.cloudOn == true && !practice
            try {
                if (cloud) {
                    // 2. The cloud orders it from codes only. toCloud() and checkOutgoing() run in the sandbox: the same gate
                    // as the extension's.
                    planNote = "Asking Gemini in the cloud to order this. It sees finding types only, never an app's name."
                    val body = Rules.obj("cloudBody", situation, shared, notChecked())
                    val sent = body.getJSONObject("body").optJSONArray("findings")
                    val types = (0 until (sent?.length() ?: 0)).map { sent!!.getJSONObject(it).optString("code") }.distinct()
                    ledger += Sent(stamp("Plan request"), "${sent?.length() ?: 0} findings by type only (${types.joinToString(", ")}) and your answers to the two questions. No app's name.", body.getString("text"))
                    val tc = System.currentTimeMillis()
                    val p = Rules.obj("planPrompt", body.getJSONObject("body"))
                    val decls = p.getJSONArray("tools").getJSONObject(0).getJSONArray("functionDeclarations")
                    val fns = (0 until decls.length()).map { i ->
                        val d = decls.getJSONObject(i)
                        Ai.Function(d) { args ->
                            val name = d.getString("name")
                            val answer = if (name == "ask_user") askPerson(args.optString("question")) else JSONObject(Rules.call("answerCall", name, args))
                            if (name == "ask_device") deviceAnswers++
                            ledger += Sent(stamp("Answer to $name"), when (name) {
                                "get_steps" -> "The public steps for ${answer.optJSONObject("entries")?.length() ?: 0} finding types, from the steps library. The same text is on the website."
                                "ask_device" -> "One word about one finding: ${answer.optString("answer", "unknown")}."
                                "ask_user" -> "Your answer: ${answer.optString("answer")}."
                                else -> "A note that the function is not known."
                            }, answer.toString(2))
                            answer
                        }
                    }
                    val ask: suspend () -> Ai.Answer = {
                        Ai.jsonWithFunctions(Ai.Prompt(p.getString("system"), p.getJSONObject("schema")),
                            listOf(Ai.Text(body.getString("text"))), settings!!.models, fns)
                    }
                    val r = try { ask() } catch (e: Throwable) {
                        // The App Check token was not ready in time (the SDK waits about 10 s; a slow phone needs more).
                        // Wait for it, then ask once more. The request is the same one already shown in the ledger.
                        if (!e.toString().contains("App Check", ignoreCase = true)) throw e
                        note("App Check token was not ready. Waiting for it, then asking once more.")
                        val ready = (getApplication<Application>() as? app.web.sparekey.SpareKeyApp)?.awaitAppCheck(40_000) ?: false
                        if (!ready) throw e
                        ask()
                    }
                    val settled = Rules.obj("settle", r.json, situation, notChecked())
                    plan = settled.getJSONObject("plan"); planSource = "cloud:${r.model}"
                    note("Plan ordered by ${r.model} in the cloud in ${secs(tc)}, with ${fns.size} functions offered and $deviceAnswers answered from this phone. Code fixed ${settled.optJSONArray("fired")?.length() ?: 0} things.")
                    planNote = "Ordered by ${r.model} from finding types only. Code checked it against the safety rules" +
                        (if ((settled.optJSONArray("fired")?.length() ?: 0) > 0) " and made ${settled.getJSONArray("fired").length()} fixes." else ".")
                } else if (nano == "available") {
                    // 3. Plan help from the cloud is off: Gemini Nano orders it on this phone. Nothing leaves the phone.
                    planNote = "Asking Gemini Nano on this phone to order this. Nothing is sent anywhere."
                    val body = Rules.obj("cloudBody", situation, shared, notChecked())
                    val p = Rules.obj("planPrompt", body.getJSONObject("body"))
                    val r = withTimeoutOrNull(90_000) {
                        Ai.json(Ai.Prompt(p.getString("deviceSystem"), p.getJSONObject("schema")), listOf(Ai.Text(body.getString("text"))),
                            Ai.Mode.DEVICE_ONLY, LiveSettings.DEFAULT_MODELS)
                    }
                    if (r != null && r.onDevice) {
                        val settled = Rules.obj("settle", r.json, situation, notChecked())
                        plan = settled.getJSONObject("plan"); planSource = "device"
                        planNote = "Ordered by Gemini Nano on this phone. Code checked it against the safety rules."
                    } else planNote = "Gemini Nano did not answer in time. This is the plan made by Spare Key's rules on this phone."
                } else {
                    planNote = if (practice) "Practice check: this plan was made by Spare Key's rules on this phone." else "This plan was made by Spare Key's rules on this phone."
                }
            } catch (e: Throwable) {
                android.util.Log.w("SpareKey", "plan: ${e.javaClass.simpleName}: ${e.message?.take(300)}")
                note("The model did not answer (${e.javaClass.simpleName}). The plan made by code is shown.")
                planNote = "The cloud did not answer. This is the plan made by Spare Key's rules on this phone."
            } finally {
                planBusy = false
                asking = null
            }
        }
    }

    private suspend fun askPerson(question: String): JSONObject {
        val wait = CompletableDeferred<String>()
        asking = question to wait
        val answer = withTimeoutOrNull(180_000) { wait.await() } ?: "skipped"
        asking = null
        return JSONObject().put("answer", answer)
    }

    fun answerAsk(value: String) { asking?.second?.complete(value) }

    private fun stamp(what: String) = "$what, ${DateFormat.getTimeInstance(DateFormat.SHORT).format(Date())}"

    // ---- Quick exit -----------------------------------------------------------------------------------------------
    /** Forgets everything from this check. The activity then leaves for an ordinary page. */
    fun forgetAll() {
        findings = emptyList(); notRead = emptyList(); builtIn = 0; ownership.clear(); revealed.clear()
        plan = null; planNote = ""; ledger.clear(); log.clear(); situation = JSONObject(); screen = Safety
        asking?.second?.complete("skipped"); asking = null
    }
}
