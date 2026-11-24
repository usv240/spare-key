package app.web.sparekey.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import app.web.sparekey.R

/**
 * The Chrome extension's side panel colours, light and dark (extension/src/panel.css), so the phone and the panel are
 * one product. Dark follows the phone's own setting: a person checking at night should not light up the room.
 * MainActivity sets `dark` before the first frame; every colour below is read through it.
 */
object Ink {
    var dark by mutableStateOf(false)
    val ground get() = if (dark) Color(0xFF15171A) else Color(0xFFF7F4EE)
    val surface get() = if (dark) Color(0xFF1D2024) else Color(0xFFFFFFFF)
    val text get() = if (dark) Color(0xFFE9E6E0) else Color(0xFF1F2328)
    val muted get() = if (dark) Color(0xFFB5B1AA) else Color(0xFF4A5058)
    val line get() = if (dark) Color(0xFF33373D) else Color(0xFFDDD7CC)
    val control get() = if (dark) Color(0xFF7D828A) else Color(0xFF8A8478)
    val accent get() = if (dark) Color(0xFF86C2AE) else Color(0xFF2F5D50)
    val onAccent get() = if (dark) Color(0xFF0F1A16) else Color(0xFFFFFFFF)
    val tint get() = if (dark) Color(0xFF22302B) else Color(0xFFE3ECE8)
    val caution get() = if (dark) Color(0xFFE5AE57) else Color(0xFF8A5200)
    val cautionBg get() = if (dark) Color(0xFF2B2318) else Color(0xFFFBF1E1)
    val focus get() = if (dark) Color(0xFF79B8FF) else Color(0xFF1F6FEB)
}

@OptIn(androidx.compose.ui.text.ExperimentalTextApi::class)
private fun atkinson(w: Int) = Font(R.font.atkinson, FontWeight(w), variationSettings = FontVariation.Settings(FontVariation.weight(w)))
val Atkinson = FontFamily(atkinson(400), atkinson(500), atkinson(600), atkinson(700))

private val type = Typography(
    displaySmall = TextStyle(fontFamily = Atkinson, fontWeight = FontWeight(700), fontSize = 28.sp, lineHeight = 34.sp, letterSpacing = (-0.3).sp),
    headlineSmall = TextStyle(fontFamily = Atkinson, fontWeight = FontWeight.Bold, fontSize = 22.sp, lineHeight = 28.sp),
    titleLarge = TextStyle(fontFamily = Atkinson, fontWeight = FontWeight.Bold, fontSize = 18.sp, lineHeight = 24.sp),
    titleMedium = TextStyle(fontFamily = Atkinson, fontWeight = FontWeight.Bold, fontSize = 16.sp, lineHeight = 22.sp),
    titleSmall = TextStyle(fontFamily = Atkinson, fontWeight = FontWeight.Bold, fontSize = 14.sp, lineHeight = 20.sp),
    bodyLarge = TextStyle(fontFamily = Atkinson, fontSize = 17.sp, lineHeight = 26.sp),
    bodyMedium = TextStyle(fontFamily = Atkinson, fontSize = 16.sp, lineHeight = 24.sp),
    bodySmall = TextStyle(fontFamily = Atkinson, fontSize = 14.sp, lineHeight = 20.sp),
    labelLarge = TextStyle(fontFamily = Atkinson, fontWeight = FontWeight.Bold, fontSize = 16.sp, lineHeight = 20.sp),
    labelMedium = TextStyle(fontFamily = Atkinson, fontWeight = FontWeight.Bold, fontSize = 14.sp, lineHeight = 18.sp),
    labelSmall = TextStyle(fontFamily = Atkinson, fontWeight = FontWeight.Medium, fontSize = 13.sp, lineHeight = 16.sp),
)

@Composable
fun SpareKeyTheme(content: @Composable () -> Unit) {
    val scheme = if (Ink.dark) darkColorScheme(
        primary = Ink.accent, onPrimary = Ink.onAccent,
        background = Ink.ground, onBackground = Ink.text,
        surface = Ink.ground, onSurface = Ink.text, surfaceContainer = Ink.surface, surfaceContainerLow = Ink.surface,
        surfaceContainerHigh = Ink.surface, surfaceContainerHighest = Ink.tint,
        onSurfaceVariant = Ink.muted, outline = Ink.control, outlineVariant = Ink.line,
        secondaryContainer = Ink.tint, onSecondaryContainer = Ink.text,
        error = Ink.caution,
    ) else lightColorScheme(
        primary = Ink.accent, onPrimary = Ink.onAccent,
        background = Ink.ground, onBackground = Ink.text,
        surface = Ink.ground, onSurface = Ink.text, surfaceContainer = Ink.surface, surfaceContainerLow = Ink.surface,
        surfaceContainerHigh = Ink.surface, surfaceContainerHighest = Ink.tint,
        onSurfaceVariant = Ink.muted, outline = Ink.control, outlineVariant = Ink.line,
        secondaryContainer = Ink.tint, onSecondaryContainer = Ink.text,
        error = Ink.caution,
    )
    MaterialTheme(colorScheme = scheme, typography = type, content = content)
}
