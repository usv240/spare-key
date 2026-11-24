package app.web.sparekey.ui

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.graphics.drawable.toBitmap
import org.json.JSONObject

// The words follow the extension's writing rules (EXPERIENCE.md section 2): plain words, never "safe" or "secure",
// and an empty result never reads as an all-clear. Every screen is one column that reads top to bottom, works at
// twice the text size, in dark, and with TalkBack (headings, radio groups, and progress said aloud).

private fun JSONObject.strings(key: String): List<String> = optJSONArray(key)?.let { a -> (0 until a.length()).map { a.getString(it) } } ?: emptyList()

/** True when the person has made text much larger: side-by-side choices then stack, so no word is cut. */
@Composable
private fun largeText() = LocalDensity.current.fontScale > 1.3f

private fun Modifier.said() = semantics { liveRegion = LiveRegionMode.Polite }

@Composable
fun SafetyScreen(m: AppModel) {
    val context = LocalContext.current
    val open = { intent: Intent -> try { context.startActivity(intent) } catch (_: Throwable) {} }
    Title("Before you start")
    Body("Spare Key looks at this phone's settings and lists every app that could let someone watch it: read your screen, your messages or your notifications, or see where you are. It only reads. It changes nothing.")
    Section(tone = Ink.cautionBg, edge = Ink.cautionBg) {
        Text("If an app on this phone is watching it, that app may see that you ran this check.", style = MaterialTheme.typography.titleSmall, color = Ink.text)
        Body("A phone the other person has never had, like a trusted friend's, is a better place to plan. Quick exit is at the top of every screen.")
    }
    if (m.startError != null) Section(tone = Ink.cautionBg, edge = Ink.cautionBg) { Body(m.startError!!, Modifier.said()) }
    Primary(if (m.ready || m.startError != null) "Check this phone" else "Getting ready", { m.check(practiceRun = false) }, enabled = m.ready)
    Secondary("Try a practice phone first", { m.check(practiceRun = true) }, enabled = m.ready)
    Muted("The practice phone is made up. It shows what a check finds without reading this phone.")
    Section {
        Text("Talk to someone now, free, all day, every day", style = MaterialTheme.typography.titleSmall, color = Ink.text)
        Muted("The National Domestic Violence Hotline.")
        Secondary("Call 1-800-799-7233", { open(Intent(Intent.ACTION_DIAL, Uri.parse("tel:18007997233"))) })
        Secondary("Text START to 88788", { open(Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:88788")).putExtra("sms_body", "START")) })
        Muted("A call or a text shows in this phone's history.")
    }
    Section {
        Muted(when (m.nano) {
            "available" -> "Gemini Nano is ready on this phone. It sorts the apps here; the list never leaves the phone."
            "downloading" -> "Gemini Nano is getting ready on this phone. You can check now with Spare Key's rules alone."
            "downloadable" -> "Gemini Nano can be downloaded on this phone. Until then, Spare Key's rules check the phone alone."
            else -> "This phone can't run Gemini Nano. Spare Key's rules check the phone alone, and the results say so."
        })
        // The whole row is the switch: one large target, one thing for TalkBack to read.
        Row(Modifier.fillMaxWidth().heightIn(min = 56.dp).toggleable(m.cloudOn, role = Role.Switch) { m.setCloud(it) },
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Column(Modifier.weight(1f)) {
                Text("Plan help from Gemini in the cloud", style = MaterialTheme.typography.titleSmall, color = Ink.text)
                Muted(if (m.cloudOn) "On. It sees finding types only, never an app's name." else "Off. Your plan is made on this phone.")
            }
            Switch(m.cloudOn, null, colors = SwitchDefaults.colors(checkedTrackColor = Ink.accent, checkedThumbColor = Ink.onAccent))
        }
    }
}

@Composable
fun CheckingScreen(m: AppModel, s: AppModel.Checking) {
    Title("Checking this phone")
    Muted("Spare Key reads this phone's settings. It does not open, change or remove any app.")
    Section {
        Text(s.line, style = MaterialTheme.typography.titleSmall, color = Ink.text, modifier = Modifier.said())
        if (s.total > 1) {
            LinearProgressIndicator(progress = { s.done.toFloat() / s.total }, modifier = Modifier.fillMaxWidth(), color = Ink.accent, trackColor = Ink.line)
            Muted("${s.done} of ${s.total}")
        } else LinearProgressIndicator(Modifier.fillMaxWidth(), color = Ink.accent, trackColor = Ink.line)
    }
    // Gemini Nano can take a while on a phone with many apps. The findings do not depend on it: it only adds a note.
    if (s.total > 1) {
        Secondary("Show results now", { m.showResultsNow() })
        Muted("Every app is already listed. Gemini Nano only adds a note about what kind of app each one seems to be.")
    }
}

@Composable
fun ResultsScreen(m: AppModel) {
    val context = LocalContext.current
    val lib = m.library
    val codeText = lib.optJSONObject("codeText") ?: JSONObject()
    val labels = lib.optJSONObject("groupLabels") ?: JSONObject()
    val entries = lib.optJSONObject("entries") ?: JSONObject()
    Title(if (m.practice) "What we found on Jordan's phone" else "What we found on this phone")
    if (m.practice) Section(tone = Ink.tint, edge = Ink.tint) { Body("Practice check. This is a made-up phone for a person called Jordan. Nothing on this phone was read.") }
    Body(when {
        m.findings.isEmpty() -> "Spare Key did not find an app here that could watch this phone. That is not the same as nothing being there: it did not check everything. See Not checked below."
        m.findings.size == 1 -> "Spare Key read ${m.appsSeen} apps with special access and listed 1 thing that could let someone watch this phone."
        else -> "Spare Key read ${m.appsSeen} apps with special access and listed ${m.findings.size} things that could let someone watch this phone."
    })
    Muted(listOfNotNull(m.checkedAt.ifEmpty { null }, if (m.nanoSorted > 0) "Gemini Nano sorted ${m.nanoSorted} apps on this phone" else "Sorted by Spare Key's rules on this phone").joinToString(" · "))

    val groups = lib.strings("groups").ifEmpty { listOf("phone", "location") }
    for (g in groups) {
        val items = m.findings.filter { it.optString("group") == g }
        if (items.isEmpty()) continue
        Heading("${labels.optString(g, g)} (${items.size})")
        for (f in items) FindingCard(m, f, codeText, entries, onOpen = { pkg ->
            try { context.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$pkg"))) } catch (_: Throwable) {}
        })
    }

    Heading("Not checked")
    Section {
        if ("phone.apps" in m.notRead) Body("The apps on this phone: Android did not let Spare Key read the list. Open Settings, then Apps, then Special app access, and look at each kind yourself.")
        if ("phone.settings" in m.notRead) Body("USB debugging: Android does not let apps like Spare Key read this setting. Open Settings, then System, then Developer options, and look for USB debugging and Wireless debugging.")
        if (m.builtIn > 0) Body("${m.builtIn} apps that came with this phone also have some of these powers, for their own job. They are not listed. If someone has rooted this phone, an app can hide among them.")
        Body("Your Google, Gmail and Amazon accounts: Spare Key's Chrome extension checks those, on a computer.")
        Body("Apps on the other person's phone, your phone carrier, iCloud, and who your emergency contacts are in the Safety app.")
        Muted("Someone could still have access through any of these.")
    }
    if (m.findings.isNotEmpty()) Primary("Make my plan", { m.show(AppModel.Plan) })
    Secondary("Check again", { m.show(AppModel.Safety) })
}

@Composable
private fun AppIcon(pkg: String) {
    val context = LocalContext.current
    val picture = remember(pkg) {
        if (pkg.isEmpty()) null
        else try { context.packageManager.getApplicationIcon(pkg).toBitmap(96, 96).asImageBitmap() } catch (_: Throwable) { null }
    }
    // The app's own icon, as on the home screen, so the person can match it. It never leaves the phone.
    if (picture != null) Image(picture, null, Modifier.size(44.dp).clip(RoundedCornerShape(10.dp)))
    else Box(Modifier.size(44.dp).background(Ink.tint, RoundedCornerShape(10.dp)), contentAlignment = Alignment.Center) {
        Icon(Icons.phone, null, tint = Ink.accent, modifier = Modifier.size(24.dp))
    }
}

@Composable
private fun FindingCard(m: AppModel, f: JSONObject, codeText: JSONObject, entries: JSONObject, onOpen: (String) -> Unit) {
    val code = f.optString("code")
    val ref = f.optString("ref")
    val pkg = f.optString("pkg")
    val (title, means) = codeText.optJSONArray(code)?.let { it.optString(0) to it.optString(1) } ?: (code to "")
    // detail: the app's name, then what it can do, where it came from, and Gemini Nano's note, one per line.
    val lines = f.optString("detail").split("\n").filter { it.isNotBlank() }
    val name = if (pkg.isEmpty()) f.optString("label") else lines.firstOrNull() ?: f.optString("label")
    val facts = if (pkg.isEmpty()) lines else lines.drop(1)
    val notice = when (entries.optJSONObject(code)?.optString("who_can_notice")) {
        "notifies" -> "If you remove it, they are told."
        "unlikely" -> "Removing it is unlikely to be noticed."
        "noticeable" -> "If you remove it, they may notice."
        else -> "Removing it may alert them."
    }
    Section {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            AppIcon(if (m.practice) "" else pkg)
            Column(Modifier.weight(1f)) {
                Text(name, style = MaterialTheme.typography.titleMedium, color = Ink.text, modifier = Modifier.semantics { heading() })
                if (pkg.isNotEmpty()) Muted(title)
            }
        }
        for (line in facts) Body(line.replaceFirstChar { it.uppercase() })
        if (means.isNotEmpty()) Muted(means)
        Caution(notice)
        Choice(
            listOf("mine" to "Mine", "not_mine" to "Not mine", "unsure" to "Not sure"), m.ownership[ref],
            describe = { "$it: $name" }, onPick = { m.answer(ref, it) },
        )
        if (!m.practice && pkg.isNotEmpty()) LinkButton("Open this app in Settings") { onOpen(pkg) }
    }
}

/** Three choices, one row; stacked when text is large. Tapping the chosen one clears it. */
@Composable
private fun Choice(options: List<Pair<String, String>>, current: String?, describe: (String) -> String, onPick: (String?) -> Unit) {
    val shape = RoundedCornerShape(8.dp)
    val frame = Modifier.fillMaxWidth().clip(shape).border(1.dp, Ink.control, shape).selectableGroup()
    if (largeText()) Column(frame) { for ((v, w) in options) ChoiceOne(v, w, current, describe, onPick, Modifier.fillMaxWidth()) }
    else Row(frame) { for ((v, w) in options) ChoiceOne(v, w, current, describe, onPick, Modifier.weight(1f)) }
}

@Composable
private fun ChoiceOne(value: String, word: String, current: String?, describe: (String) -> String, onPick: (String?) -> Unit, modifier: Modifier) {
    val on = current == value
    val fill by animateColorAsState(if (on) Ink.accent else Ink.surface, tween(120), label = "choice")
    Text(word, style = MaterialTheme.typography.labelMedium, color = if (on) Ink.onAccent else Ink.text, textAlign = TextAlign.Center,
        modifier = modifier.heightIn(min = 48.dp).background(fill)
            .selectable(on, role = Role.RadioButton) { onPick(if (on) null else value) }
            .semantics { contentDescription = describe(word); stateDescription = if (on) "Chosen" else "Not chosen" }
            .padding(vertical = 14.dp, horizontal = 8.dp))
}

@Composable
fun PlanScreen(m: AppModel) {
    val lib = m.library
    val entries = lib.optJSONObject("entries") ?: JSONObject()
    val codeText = lib.optJSONObject("codeText") ?: JSONObject()
    Title("Your plan")
    if (m.plan == null) {
        Body("Two questions help put the steps in an order that fits you. You can skip them.")
        Question(m, "safe_to_change_now", "Is now a good time to make changes the other person might notice?", listOf("yes" to "Yes", "no" to "No", "not_sure" to "Not sure"))
        Question(m, "has_advocate", "Do you have an advocate helping you?", listOf("yes" to "Yes", "no" to "No", "prefer_not_to_say" to "Prefer not to say"))
        Muted(if (m.cloudOn && !m.practice) "Gemini in the cloud orders the plan from finding types only. Your answers to these two questions go too. App names never do." else "Your plan is made on this phone.")
        Primary("Make my plan", { m.makePlan() })
        Secondary("Back to what was found", { m.show(AppModel.Results) })
        return
    }
    if (m.planNote.isNotEmpty() || m.planBusy) Section(tone = Ink.tint, edge = Ink.tint) {
        Text(m.planNote.ifEmpty { "Putting your plan in order" }, style = MaterialTheme.typography.bodySmall, color = Ink.text, modifier = Modifier.said())
        if (m.planBusy) {
            LinearProgressIndicator(Modifier.fillMaxWidth(), color = Ink.accent, trackColor = Ink.line)
            Muted("The plan below was made by Spare Key's rules and is ready to use now. The order may change.")
        }
    }
    m.asking?.let { (q, _) ->
        Section(tone = Ink.cautionBg, edge = Ink.cautionBg) {
            Text(mapOf("recognise_this" to "Do you recognise this?", "set_up_by_you" to "Did you set this up yourself?", "still_need_this" to "Do you still need this?", "they_know_you_use_this" to "Does the other person know you use this?")[q] ?: "Can you tell Spare Key more?",
                style = MaterialTheme.typography.titleSmall, color = Ink.text, modifier = Modifier.said())
            if (largeText()) Column(verticalArrangement = Arrangement.spacedBy(8.dp)) { for ((v, w) in ANSWERS) Secondary(w, { m.answerAsk(v) }) }
            else Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { for ((v, w) in ANSWERS) Secondary(w, { m.answerAsk(v) }, Modifier.weight(1f)) }
            Muted("Only your answer is sent, never what this is. You can leave it: the plan goes on without it.")
        }
    }
    val actions = m.plan!!.optJSONArray("actions")
    var n = 0
    for (i in 0 until (actions?.length() ?: 0)) {
        val a = actions!!.getJSONObject(i)
        val code = a.optString("code")
        val title = codeText.optJSONArray(code)?.optString(0) ?: ""
        val wait = a.optString("action") == "wait"
        val head = when (a.optString("action")) {
            "document" -> "Screenshot these first (${a.optJSONArray("refs")?.length() ?: 0})"
            "talk_to_advocate" -> "Talk to an advocate"
            "change_now" -> "Change now: $title"
            "wait" -> "Leave for a better time: $title"
            else -> "Check it yourself"
        }
        n++
        Section(tone = if (wait) Ink.cautionBg else Ink.surface, edge = if (wait) Ink.cautionBg else Ink.line) {
            Text("$n. $head", style = MaterialTheme.typography.titleMedium, color = Ink.text, modifier = Modifier.semantics { heading() })
            // Which apps this step is about. Names are shown here, on the phone; the model only ever saw "f1".
            val about = a.strings("refs").mapNotNull { r -> m.findings.firstOrNull { it.optString("ref") == r } }
                .map { f -> if (f.optString("pkg").isEmpty()) f.optString("label") else f.optString("detail").substringBefore("\n") }
            if (about.isNotEmpty() && a.optString("action") != "talk_to_advocate") Muted(about.distinct().joinToString(", "))
            Body(a.optString("why"))
            if (a.optString("linked").isNotEmpty()) Caution(a.optString("linked"))
            if (a.optString("action") == "talk_to_advocate") Muted("Call 1-800-799-7233, or text START to 88788. Free, all day, every day.")
            entries.optJSONObject(code)?.let { e ->
                if (wait && e.optString("if_not_safe_yet").isNotEmpty()) Body(e.optString("if_not_safe_yet"))
                val steps = e.strings("steps")
                if (steps.isNotEmpty()) {
                    Text(if (wait) "When it is a good time" else "How", style = MaterialTheme.typography.titleSmall, color = Ink.text)
                    for ((k, s) in steps.withIndex()) Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("${k + 1}.", style = MaterialTheme.typography.bodySmall, color = Ink.muted)
                        Text(s, style = MaterialTheme.typography.bodySmall, color = Ink.text, modifier = Modifier.weight(1f))
                    }
                }
            }
        }
    }
    Secondary("Back to what was found", { m.show(AppModel.Results) })
}

private val ANSWERS = listOf("yes" to "Yes", "no" to "No", "not_sure" to "Not sure")

@Composable
private fun Question(m: AppModel, key: String, words: String, options: List<Pair<String, String>>) {
    Section {
        Text(words, style = MaterialTheme.typography.titleSmall, color = Ink.text, modifier = Modifier.semantics { heading() })
        Column(Modifier.selectableGroup()) {
            for ((v, w) in options) {
                val on = m.situation.optString(key) == v
                Row(Modifier.fillMaxWidth().heightIn(min = 48.dp).selectable(on, role = Role.RadioButton) { m.setSituation(key, v) }, verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(on, null, colors = RadioButtonDefaults.colors(selectedColor = Ink.accent, unselectedColor = Ink.control))
                    Body(w, Modifier.padding(start = 12.dp))
                }
            }
        }
    }
}

@Composable
fun HoodScreen(m: AppModel, appCheck: String) {
    Title("Under the hood")
    Muted("Where each step runs, everything Spare Key sent from this phone, and what it did. You never need this page to use Spare Key.")
    Heading("Where each step runs")
    Section {
        Where("Reading this phone", "Spare Key's rules, on this phone. The same code as the Chrome extension, run in Android's JavaScript sandbox.")
        Where("Sorting the apps", if (m.nano == "available") "Gemini Nano, on this phone (Firebase AI Logic, on-device only). The list of apps never leaves." else "Spare Key's rules, on this phone. This phone can't run Gemini Nano.")
        Where("Ordering your plan", if (m.cloudOn) "Gemini in the cloud (Firebase AI Logic, cloud only), from finding types only. Code checks every plan against the safety rules." else if (m.nano == "available") "Gemini Nano, on this phone." else "Spare Key's rules, on this phone.")
        Where("Settings and switches", "Firebase Remote Config (${m.rcFrom.ifEmpty { "not yet fetched" }}).")
        Where("App Check", appCheck)
    }
    Heading("What left this phone (${m.ledger.size})")
    if (m.ledger.isEmpty()) Muted("Nothing yet. Only finding types and your chosen answers can ever be sent, and only for the plan.")
    for (sent in m.ledger) {
        var open by rememberSaveable(sent.what) { mutableStateOf(false) }
        Section {
            Text(sent.what, style = MaterialTheme.typography.titleSmall, color = Ink.text, modifier = Modifier.semantics { heading() })
            Body(sent.summary)
            LinkButton(if (open) "Hide the exact text" else "Show the exact text (${sent.text.length} characters)") { open = !open }
            // Real data, so a fixed-width face: the request or answer, word for word.
            if (open) Text(sent.text, fontFamily = FontFamily.Monospace, fontSize = 12.sp, lineHeight = 17.sp, color = Ink.text,
                modifier = Modifier.fillMaxWidth().background(Ink.ground, RoundedCornerShape(8.dp)).padding(12.dp).horizontalScroll(rememberScrollState()))
        }
    }
    Heading("What Spare Key did (${m.log.size})")
    Muted("Kept in memory on this phone and forgotten with the check. Spare Key sends no usage or crash reports.")
    if (m.log.isNotEmpty()) Section { for (line in m.log) Text(line, style = MaterialTheme.typography.bodySmall, color = Ink.text) }
}

@Composable
private fun Where(what: String, where: String) = Column {
    Muted(what)
    Body(where)
}
