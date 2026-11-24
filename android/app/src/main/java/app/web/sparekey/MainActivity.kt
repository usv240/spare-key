package app.web.sparekey

import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Bundle
import android.os.SystemClock
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.web.sparekey.ui.AppModel
import app.web.sparekey.ui.CheckingScreen
import app.web.sparekey.ui.HoodScreen
import app.web.sparekey.ui.Icons
import app.web.sparekey.ui.Ink
import app.web.sparekey.ui.PlanScreen
import app.web.sparekey.ui.ResultsScreen
import app.web.sparekey.ui.SafetyScreen
import app.web.sparekey.ui.SpareKeyTheme

class MainActivity : ComponentActivity() {
    private val model: AppModel by viewModels()
    private var hood by mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        // Dark follows the phone's own setting, set before the first frame so there is no flash of the other one.
        Ink.dark = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent { SpareKeyTheme { App(model, hood, { hood = it }, ::quickExit, { moveTaskToBack(true) }, (application as SpareKeyApp).appCheckMode) } }
    }

    /**
     * Quick exit: forget everything from this check, show an ordinary page in the browser, and close Spare Key and
     * remove it from the recent apps list. Also: back pressed twice within about a second (see App below).
     */
    fun quickExit() {
        model.forgetAll()
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(QUICK_EXIT_URL)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (_: Throwable) {}
        finishAndRemoveTask()
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        Ink.dark = (newConfig.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
    }

    companion object {
        const val QUICK_EXIT_URL = "https://www.google.com/search?q=weather"
    }
}

private const val DOUBLE_BACK_MS = 1200L

@Composable
private fun App(m: AppModel, hood: Boolean, setHood: (Boolean) -> Unit, exit: () -> Unit, leave: () -> Unit, appCheck: String) {
    // Back: one press goes back a screen; two presses within about a second are Quick exit, like Escape twice in the
    // extension. Handled here because current Android sends back through a callback and never calls onKeyDown for it.
    val lastBack = remember { longArrayOf(0L) }
    BackHandler {
        val now = SystemClock.elapsedRealtime()
        if (now - lastBack[0] < DOUBLE_BACK_MS) { exit(); return@BackHandler }
        lastBack[0] = now
        when {
            hood -> setHood(false)
            m.screen == AppModel.Plan -> m.show(AppModel.Results)
            m.screen is AppModel.Checking -> {}
            m.screen == AppModel.Safety -> leave()
            else -> m.show(AppModel.Safety)
        }
    }
    Scaffold(containerColor = Ink.ground) { pad ->
        Column(Modifier.fillMaxSize().padding(pad)) {
            // Quick exit on every screen, always in the same place.
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.key, null, tint = Ink.accent, modifier = Modifier.size(24.dp))
                Text("Spare Key", style = MaterialTheme.typography.titleMedium, color = Ink.text, modifier = Modifier.padding(start = 8.dp))
                Spacer(Modifier.weight(1f))
                TextButton(exit, modifier = Modifier.heightIn(min = 48.dp).border(1.dp, Ink.control, RoundedCornerShape(8.dp))) {
                    Icon(Icons.exit, null, tint = Ink.text, modifier = Modifier.size(18.dp))
                    Text("Quick exit", style = MaterialTheme.typography.labelLarge, color = Ink.text, modifier = Modifier.padding(start = 6.dp))
                }
            }
            if (m.screen != AppModel.Safety) {
                TabRow(if (hood) 1 else 0, containerColor = Ink.ground, contentColor = Ink.text, indicator = { pos ->
                    TabRowDefaults.SecondaryIndicator(Modifier.tabIndicatorOffset(pos[if (hood) 1 else 0]), color = Ink.text)
                }) {
                    Tab(!hood, { setHood(false) }, text = { Text("Your check") })
                    Tab(hood, { setHood(true) }, text = { Text("Under the hood") })
                }
            }
            // Each screen keeps its own place: a new screen opens at its top, and coming back to the results returns
            // to where the person was. The change is a short fade (no movement), and none at all when the phone has
            // animations turned off.
            val page = when {
                hood -> "hood"
                m.screen is AppModel.Checking -> "checking"
                m.screen == AppModel.Results -> "results"
                m.screen == AppModel.Plan -> if (m.plan == null) "questions" else "plan"
                else -> "start"
            }
            val places = remember { HashMap<String, ScrollState>() }
            if (page == "start" || page == "checking") { places.remove("results"); places.remove("plan"); places.remove("questions") }
            AnimatedContent(page, Modifier.fillMaxSize(), transitionSpec = { fadeIn(tween(160)) togetherWith fadeOut(tween(90)) },
                contentAlignment = Alignment.TopCenter, label = "screen") { shown ->
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
                    Column(
                        Modifier.widthIn(max = 640.dp).fillMaxWidth().verticalScroll(places.getOrPut(shown) { ScrollState(0) }).padding(horizontal = 20.dp, vertical = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                    ) {
                        when (shown) {
                            "hood" -> HoodScreen(m, appCheck)
                            "checking" -> (m.screen as? AppModel.Checking)?.let { CheckingScreen(m, it) }
                            "results" -> ResultsScreen(m)
                            "questions", "plan" -> PlanScreen(m)
                            else -> SafetyScreen(m)
                        }
                    }
                }
            }
        }
    }
}
