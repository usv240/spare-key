package app.web.sparekey.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

private val Card = RoundedCornerShape(10.dp)
private val Control = RoundedCornerShape(8.dp)

@Composable
fun Section(modifier: Modifier = Modifier, tone: Color = Ink.surface, edge: Color = Ink.line, content: @Composable () -> Unit) =
    Column(modifier.fillMaxWidth().background(tone, Card).border(1.dp, edge, Card).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) { content() }

@Composable
fun Title(text: String) = Text(text, style = MaterialTheme.typography.displaySmall, color = Ink.text, modifier = Modifier.semantics { heading() })

@Composable
fun Heading(text: String) = Text(text, style = MaterialTheme.typography.titleLarge, color = Ink.text, modifier = Modifier.semantics { heading() })

@Composable
fun Body(text: String, modifier: Modifier = Modifier) = Text(text, style = MaterialTheme.typography.bodyMedium, color = Ink.text, modifier = modifier)

@Composable
fun Muted(text: String, modifier: Modifier = Modifier) = Text(text, style = MaterialTheme.typography.bodySmall, color = Ink.muted, modifier = modifier)

@Composable
fun Primary(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) =
    Button(onClick, modifier.fillMaxWidth().heightIn(min = 52.dp), enabled = enabled, shape = Control,
        colors = ButtonDefaults.buttonColors(containerColor = Ink.accent, contentColor = Ink.onAccent, disabledContainerColor = Ink.line, disabledContentColor = Ink.muted)) { Text(text, style = MaterialTheme.typography.labelLarge, textAlign = TextAlign.Center) }

@Composable
fun Secondary(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) =
    OutlinedButton(onClick, modifier.fillMaxWidth().heightIn(min = 52.dp), enabled = enabled, shape = Control, border = BorderStroke(1.dp, if (enabled) Ink.control else Ink.line),
        colors = ButtonDefaults.outlinedButtonColors(containerColor = Ink.surface, contentColor = Ink.text, disabledContentColor = Ink.muted)) { Text(text, style = MaterialTheme.typography.labelLarge, textAlign = TextAlign.Center) }

@Composable
fun LinkButton(text: String, onClick: () -> Unit) =
    TextButton(onClick, contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 0.dp, vertical = 4.dp)) {
        Text(text, style = MaterialTheme.typography.labelMedium, color = Ink.accent, textDecoration = TextDecoration.Underline)
    }

/** The caution line on a finding: what the other person may notice. */
@Composable
fun Caution(text: String) = Row(
    Modifier.fillMaxWidth().background(Ink.cautionBg, Control).padding(horizontal = 12.dp, vertical = 8.dp),
    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
) {
    Icon(Icons.caution, null, tint = Ink.caution, modifier = Modifier.size(18.dp))
    Text(text, style = MaterialTheme.typography.labelMedium, color = Ink.caution)
}

@Composable
fun Gap(h: Dp) = Spacer(Modifier.height(h))
