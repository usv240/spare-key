package app.web.sparekey.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.dp

/** The side panel's icons (extension/src/panel.html), as Compose vectors. */
object Icons {
    private fun stroke(name: String, size: Float, vararg paths: String): ImageVector {
        val b = ImageVector.Builder(name, 24.dp, 24.dp, size, size)
        for (d in paths) b.addPath(PathParser().parsePathString(d).toNodes(), stroke = SolidColor(Color.Black), strokeLineWidth = size / 12f,
            strokeLineCap = StrokeCap.Round, strokeLineJoin = StrokeJoin.Round, fill = null)
        return b.build()
    }

    val key: ImageVector = ImageVector.Builder("key", 24.dp, 24.dp, 24f, 24f).apply {
        addPath(PathParser().parsePathString("M7.5 6.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Zm0 3.3a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Z").toNodes(),
            fill = SolidColor(Color.Black), pathFillType = PathFillType.EvenOdd)
        addPath(PathParser().parsePathString("M12 10.6h9.5a1 1 0 0 1 1 1v.8a1 1 0 0 1-1 1H20.5v2.4a.8.8 0 0 1-.8.8h-1a.8.8 0 0 1-.8-.8v-2.4h-.9v1.6a.8.8 0 0 1-.8.8h-1a.8.8 0 0 1-.8-.8v-1.6H12Z").toNodes(),
            fill = SolidColor(Color.Black))
    }.build()
    val exit = stroke("exit", 16f, "M6.5 2.5h-3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3", "M10 5l3 3-3 3", "M13 8H6")
    val caution = stroke("caution", 16f, "M8 2.2 14.3 13H1.7L8 2.2Z", "M8 6.4v3.2", "M8 11.3h.01")
    val phone = stroke("phone", 24f, "M5 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z", "M11 18h2")
}
