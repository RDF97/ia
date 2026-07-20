package com.rdf.tpvevento.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// iOS system palette (Apple HIG)
val Background = Color(0xFFF2F2F7)
val CardWhite = Color(0xFFFFFFFF)
val Label = Color(0xFF1C1C1E)
val SecondaryLabel = Color(0xFF6E6E73)
val TertiaryLabel = Color(0xFFAEAEB2)
val Separator = Color(0xFFE5E5EA)
val Fill = Color(0xFFE9E9EB)
val Blue = Color(0xFF007AFF)
val Green = Color(0xFF34C759)
val Red = Color(0xFFFF3B30)
val Orange = Color(0xFFFF9500)

@Composable
fun TpvTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = Blue,
            onPrimary = Color.White,
            background = Background,
            onBackground = Label,
            surface = CardWhite,
            onSurface = Label,
            surfaceVariant = Fill,
            onSurfaceVariant = SecondaryLabel,
            outline = Separator,
            error = Red,
        ),
        content = content,
    )
}
