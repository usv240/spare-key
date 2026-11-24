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
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
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
/** How long the cloud may take to order a plan that is already on the screen. */
private const val CLOUD_WAIT_MS = 45_000L

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
    /** While Gemini Nano downloads: megabytes so far and in all (0 until Android says), and why it failed, if it did. */
    var nanoMb by mutableStateOf(0L to 0L)
        private set
    var nanoError by mutableStateOf("")
        private set

    /** The person asked for Gemini Nano. Android downloads it; the check works the same in the meantime. */
    fun getNano() {
        if (nano != "downloadable") return
        nano = "downloading"; nanoError = ""; nanoMb = 0L to 0L
        note("Gemini Nano: download asked for.")
        val t = System.currentTimeMillis()
        viewModelScope.launch {
            val failed = Ai.download { done, total -> nanoMb = (done shr 20) to (total shr 20) }
            nano = Ai.deviceStatus()
            if (failed != null && nano != "available") {
                nanoError = "Gemini Nano could not be downloaded just now. Spare Key's rules check the phone alone."
                android.util.Log.w("SpareKey", "nano download: $failed")
                note("Gemini Nano download failed.")
                if (nano == "downloading") nano = "downloadable"
            } else {
                note("Gemini Nano on this phone: $nano, after ${secs(t)}${if (nanoMb.second > 0) " (${nanoMb.second} MB)" else ""}.")
                if (nano == "available") Ai.warmUp()
            }
        }
    }
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
    /** Whether the two answers on the plan screen go to the cloud with the plan request. Off unless the person says. */
    var shareAnswers by mutableStateOf(false)
        private set
    fun setShare(on: Boolean) { shareAnswers = on }

    /** "Say it more simply", by finding code. */
    data class Simpler(val steps: List<String> = emptyList(), val by: String = "", val state: String = "pending")
    val simpler = mutableStateMapOf<String, Simpler>()

    /**
     * A second check, in Kotlin, at the only place text is handed to a cloud model: no app's name or package from this
     * phone may be in it. The shared rules already check this in the sandbox (checkOutgoing); this one does not trust
     * them. It refuses the request instead of sending it.
     */
    private fun checked(what: String, text: String): String {
        val private = findings.flatMap { listOf(it.optString("name"), it.optString("pkg")) }.filter { it.length >= 3 }.distinct()
        val hit = if (practice) null else private.firstOrNull { text.contains(it, ignoreCase = true) }
        if (hit != null) {
            android.util.Log.w("SpareKey", "outgoing refused in Kotlin: $what holds a private string")
            note("Refused to send: $what held an app's name. Nothing was sent.")
            throw IllegalStateException("refused: $what holds an app's name")
        }
        android.util.Log.i("SpareKey", "outgoing checked in Kotlin: $what, ${text.length} characters, ${private.size} private strings looked for, 0 found")
        return text
    }

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
        ownership.clear(); revealed.clear(); plan = null; planNote = ""; ledger.clear(); simpler.clear()
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
            // What Gemini Nano made of them, as counts: kinds are not names. A caution is set aside when nothing code
            // can check backs it up (the app's name, where it came from, how many powers it holds).
            if (nanoSorted > 0) {
                val byKind = kinds.keys().asSequence().map { kinds.getJSONObject(it).optString("kind") }.groupingBy { it }.eachCount()
                    .entries.sortedByDescending { it.value }.joinToString(", ") { "${it.key} ${it.value}" }
                note("Gemini Nano's reading: $byKind. Cautions kept: ${findings.count { it.optString("note").isNotEmpty() }}. Set aside, with nothing to back them up: ${result.optInt("nanoSetAside")}.")
            }
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
            // The two answers go to the cloud only when the person says so (off by default, as in the extension).
            // Either way Spare Key's rules use them here, on the phone.
            val shared = JSONObject().put("safe_to_change_now", shareAnswers).put("has_advocate", shareAnswers)
            val cloud = cloudOn && settings?.cloudOn == true && !practice
            try {
                if (cloud) {
                    // 2. The cloud orders it from codes only. toCloud() and checkOutgoing() run in the sandbox: the same gate
                    // as the extension's.
                    planNote = "You can use this plan now. Gemini in the cloud is also ordering it, from finding types only, never an app's name."
                    val body = Rules.obj("cloudBody", situation, shared, notChecked())
                    val sent = body.getJSONObject("body").optJSONArray("findings")
                    val types = (0 until (sent?.length() ?: 0)).map { sent!!.getJSONObject(it).optString("code") }.distinct()
                    ledger += Sent(stamp("Plan request"), "${sent?.length() ?: 0} findings by type only (${types.joinToString(", ")})" + (if (shareAnswers) " and your answers to the two questions" else "") + ". No app's name.", checked("the plan request", body.getString("text")))
                    val tc = System.currentTimeMillis()
                    val p = Rules.obj("planPrompt", body.getJSONObject("body"))
                    val decls = p.getJSONArray("tools").getJSONObject(0).getJSONArray("functionDeclarations")
                    var live = true
                    val fns = (0 until decls.length()).map { i ->
                        val d = decls.getJSONObject(i)
                        Ai.Function(d) { args ->
                            if (!live) throw kotlinx.coroutines.CancellationException("the plan was already shown")
                            val name = d.getString("name")
                            val answer = if (name == "ask_user") askPerson(args.optString("question")) else JSONObject(Rules.call("answerCall", name, args))
                            if (name == "ask_device") deviceAnswers++
                            ledger += Sent(stamp("Answer to $name"), when (name) {
                                "get_steps" -> "The public steps for ${answer.optJSONObject("entries")?.length() ?: 0} finding types, from the steps library. The same text is on the website."
                                "ask_device" -> "One word about one finding: ${answer.optString("answer", "unknown")}."
                                "ask_user" -> "Your answer: ${answer.optString("answer")}."
                                else -> "A note that the function is not known."
                            }, checked("an answer to $name", answer.toString(2)))
                            answer
                        }
                    }
                    val ask: suspend () -> Ai.Answer = {
                        Ai.jsonWithFunctions(Ai.Prompt(p.getString("system"), p.getJSONObject("schema")),
                            listOf(Ai.Text(body.getString("text"))), settings!!.models, fns)
                    }
                    // The plan made by code is already on the screen, so the cloud gets a fixed time to improve it and no
                    // more. Time the person spends answering a question the cloud asked does not count.
                    // The call is not a child of this block: a network call that is slow to notice it was cancelled must not
                    // hold the screen. When time is up it is cancelled and left behind, and `live` stops it from asking the
                    // person anything or adding to the list of what was sent.
                    val r = run {
                        val job = viewModelScope.async {
                            try { ask() } catch (e: Throwable) {
                                // The App Check token was not ready in time (the SDK waits about 10 s; a slow phone needs
                                // more). Wait for it, then ask once more. The request is the one already in the ledger.
                                if (!e.toString().contains("App Check", ignoreCase = true)) throw e
                                note("App Check token was not ready. Waiting for it, then asking once more.")
                                val ready = (getApplication<Application>() as? app.web.sparekey.SpareKeyApp)?.awaitAppCheck(40_000) ?: false
                                if (!ready) throw e
                                ask()
                            }
                        }
                        var spent = 0L
                        while (job.isActive && spent < CLOUD_WAIT_MS) { delay(250); if (asking == null) spent += 250 }
                        if (job.isActive) { live = false; job.cancel(); null } else job.await()
                    }
                    if (r == null) {
                        note("The cloud did not answer in ${CLOUD_WAIT_MS / 1000} s. The plan made by code is shown.")
                        planNote = "The cloud took too long to answer. This is the plan made by Spare Key's rules on this phone."
                        return@launch
                    }
                    val settled = Rules.obj("settle", r.json, situation, notChecked())
                    plan = settled.getJSONObject("plan"); planSource = "cloud:${r.model}"
                    note("Plan ordered by ${r.model} in the cloud in ${secs(tc)}, with ${fns.size} functions offered and $deviceAnswers answered from this phone. Code fixed ${settled.optJSONArray("fired")?.length() ?: 0} things.")
                    planNote = "Ordered by ${r.model} from finding types only. Code checked it against the safety rules" +
                        (if ((settled.optJSONArray("fired")?.length() ?: 0) > 0) " and made ${settled.getJSONArray("fired").length()} ${if (settled.getJSONArray("fired").length() == 1) "fix" else "fixes"}." else ".")
                } else if (nano == "available") {
                    // 3. Plan help from the cloud is off: Gemini Nano orders it on this phone. Nothing leaves the phone.
                    planNote = "Asking Gemini Nano on this phone to order this. Nothing is sent anywhere."
                    val body = Rules.obj("cloudBody", situation, shared, notChecked())
                    val p = Rules.obj("planPrompt", body.getJSONObject("body"))
                    val r = withTimeoutOrNull(90_000) {
                        // A small model has little room to answer: ask for short reasons and give it more room.
                        Ai.json(Ai.Prompt(p.getString("deviceSystem") + "\nKeep each \"why\" under 12 words.", p.getJSONObject("schema")), listOf(Ai.Text(body.getString("text"))),
                            Ai.Mode.DEVICE_ONLY, LiveSettings.DEFAULT_MODELS, maxOut = 900)
                    }
                    if (r != null && r.onDevice) {
                        val settled = Rules.obj("settle", r.json, situation, notChecked())
                        plan = settled.getJSONObject("plan"); planSource = "device"
                        val fixes = settled.optJSONArray("fired")?.length() ?: 0
                        note("Plan ordered by Gemini Nano on this phone" + (if (r.cut) ", its answer cut short" else "") + ". Code fixed $fixes things.")
                        planNote = "Ordered by Gemini Nano on this phone. Nothing was sent anywhere. " +
                            (if (r.cut) "Its answer was cut short, so code added the steps it did not reach" else "Code checked it against the safety rules") +
                            (if (fixes > 0) " and made $fixes ${if (fixes == 1) "fix" else "fixes"}." else ".")
                    } else planNote = "Gemini Nano did not answer in time. This is the plan made by Spare Key's rules on this phone."
                } else {
                    planNote = if (practice) "Practice check: this plan was made by Spare Key's rules on this phone." else "This plan was made by Spare Key's rules on this phone."
                }
            } catch (e: Throwable) {
                android.util.Log.w("SpareKey", "plan: ${e.javaClass.simpleName}: ${e.message?.take(300)}")
                // Which model was asked, and the server's own short reason (a status and a few words, never anything
                // from this phone), so a failure can be told apart later.
                val asked = if (cloud) "The cloud" else "Gemini Nano"
                val reason = Regex("""(4\d\d|5\d\d)|high demand|overloaded|quota|RESOURCE_EXHAUSTED|UNAVAILABLE|timed? ?out|App Check|too (long|large)|token|not supported|busy""", RegexOption.IGNORE_CASE)
                    .findAll(e.message ?: "").map { it.value.lowercase() }.distinct().take(3).joinToString(", ")
                note("$asked did not answer (${e.javaClass.simpleName}${if (reason.isNotEmpty()) ": $reason" else ""}). The plan made by code is shown.")
                planNote = "$asked did not answer. This is the plan made by Spare Key's rules on this phone."
            } finally {
                planBusy = false
                asking = null
            }
        }
    }

    /**
     * "Say it more simply": a step's public instructions in simpler words. Hybrid inference with the fallback
     * (PREFER_ON_DEVICE): Gemini Nano when this phone has it, Gemini in the cloud when it does not. The text is the
     * steps library's, the same for everyone, so the fallback gives nothing away; it is allowed here and only here.
     */
    fun saySimpler(code: String) {
        if (simpler[code]?.state == "pending" || simpler[code]?.state == "done") return
        simpler[code] = Simpler()
        viewModelScope.launch {
            val t = System.currentTimeMillis()
            try {
                val settings = LiveSettings.get()
                val cloudAllowed = cloudOn && settings.cloudOn
                if (nano != "available" && !cloudAllowed) { simpler[code] = Simpler(state = "off"); return@launch }
                val p = Rules.obj("simplerPrompt", code)
                val text = checked("the public steps for $code", p.getString("text"))
                // With the cloud not allowed, Gemini Nano only: hybrid inference could fall back to the cloud.
                val mode = if (cloudAllowed) Ai.Mode.ON_DEVICE_FIRST else Ai.Mode.DEVICE_ONLY
                val r = withTimeoutOrNull(90_000) { Ai.json(Ai.Prompt(p.getString("system"), p.getJSONObject("schema")), listOf(Ai.Text(text)), mode, settings.models) }
                    ?: throw IllegalStateException("timed out")
                if (!r.onDevice) ledger += Sent(stamp("Simpler words"), "The public steps for one finding type ($code), to be put in simpler words. The same text is on the website. No app's name.", text)
                val steps = JSONArray(Rules.call("simplerFrom", code, r.json)).let { a -> (0 until a.length()).map { a.getString(it) } }
                simpler[code] = if (steps.isEmpty()) Simpler(state = "failed") else Simpler(steps, if (r.onDevice) "device" else "cloud", "done")
                note("Simpler words for one step by ${if (r.onDevice) "Gemini Nano on this phone" else "${r.model} in the cloud (this phone has no Gemini Nano: the fallback)"} in ${secs(t)}.")
            } catch (e: Throwable) {
                android.util.Log.w("SpareKey", "simpler: ${e.javaClass.simpleName}: ${e.message?.take(200)}")
                simpler[code] = Simpler(state = "failed")
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
        plan = null; planNote = ""; ledger.clear(); log.clear(); simpler.clear(); shareAnswers = false; situation = JSONObject(); screen = Safety
        asking?.second?.complete("skipped"); asking = null
    }
}
