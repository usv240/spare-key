package app.web.sparekey

import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Bundle
import android.view.KeyEvent
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
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
import androidx.compose.foundation.rememberScrollState
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
    private var lastBack = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        // Dark follows the phone's own setting, set before the first frame so there is no flash of the other one.
        Ink.dark = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent { SpareKeyTheme { App(model, hood, { hood = it }, ::quickExit, (application as SpareKeyApp).appCheckMode) } }
    }

    /**
     * Quick exit: forget everything from this check, show an ordinary page in the browser, and close Spare Key and
     * remove it from the recent apps list. Also: the back button pressed twice within a second, like Escape twice in
     * the extension.
     */
    fun quickExit() {
        model.forgetAll()
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(QUICK_EXIT_URL)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (_: Throwable) {}
        finishAndRemoveTask()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            val now = System.currentTimeMillis()
            if (now - lastBack < 1000) { quickExit(); return true }
            lastBack = now
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        Ink.dark = (newConfig.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
    }

    companion object {
        const val QUICK_EXIT_URL = "https://www.google.com/search?q=weather"
    }
}

@Composable
private fun App(m: AppModel, hood: Boolean, setHood: (Boolean) -> Unit, exit: () -> Unit, appCheck: String) {
    BackHandler(enabled = hood || m.screen != AppModel.Safety) {
        when {
            hood -> setHood(false)
            m.screen == AppModel.Plan -> m.show(AppModel.Results)
            m.screen is AppModel.Checking -> {}
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
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
                Column(
                    Modifier.widthIn(max = 640.dp).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    if (hood) HoodScreen(m, appCheck)
                    else when (val s = m.screen) {
                        is AppModel.Checking -> CheckingScreen(m, s)
                        AppModel.Results -> ResultsScreen(m)
                        AppModel.Plan -> PlanScreen(m)
                        else -> SafetyScreen(m)
                    }
                }
            }
        }
    }
}
