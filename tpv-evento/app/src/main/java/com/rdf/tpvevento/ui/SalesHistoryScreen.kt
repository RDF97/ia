package com.rdf.tpvevento.ui

import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rdf.tpvevento.DayRecord
import com.rdf.tpvevento.PosState
import com.rdf.tpvevento.asEuros
import com.rdf.tpvevento.ui.theme.Background
import com.rdf.tpvevento.ui.theme.Blue
import com.rdf.tpvevento.ui.theme.Label
import com.rdf.tpvevento.ui.theme.Red
import com.rdf.tpvevento.ui.theme.SecondaryLabel
import com.rdf.tpvevento.ui.theme.Separator
import com.rdf.tpvevento.ui.theme.TertiaryLabel
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

private val Tabular = TextStyle(fontFeatureSettings = "tnum")
private val DayFormat = DateTimeFormatter.ofPattern("EEEE d MMM", Locale.forLanguageTag("es-ES"))

private fun formatDay(date: String): String = runCatching {
    val day = LocalDate.parse(date)
    when (date) {
        LocalDate.now().toString() -> "Hoy"
        LocalDate.now().minusDays(1).toString() -> "Ayer"
        else -> day.format(DayFormat).replaceFirstChar { it.uppercase() }
    }
}.getOrDefault(date)

private fun dayToText(day: DayRecord): String = buildString {
    append("TPV Evento · ${formatDay(day.date)}\n")
    append("Total: ${day.totalCents.asEuros()}  ·  ${day.salesCount} ventas\n\n")
    day.lines.sortedByDescending { it.units }.forEach { line ->
        val label = "${line.emoji} ${line.name}".trim()
        append("$label  ×${line.units}   ${line.totalCents.asEuros()}\n")
    }
}

@Composable
fun SalesHistoryScreen(state: PosState, onDone: () -> Unit) {
    val context = LocalContext.current
    var dayToDelete by remember { mutableStateOf<DayRecord?>(null) }

    Surface(Modifier.fillMaxSize(), color = Background) {
        Column(
            Modifier
                .fillMaxSize()
                .padding(horizontal = 24.dp, vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .widthIn(max = 760.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "Historial de ventas",
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    color = Label,
                )
                Spacer(Modifier.weight(1f))
                TextButton(onClick = onDone) {
                    Text("Cerrar", fontSize = 15.sp, color = Blue)
                }
            }

            Spacer(Modifier.height(12.dp))

            if (state.history.isEmpty()) {
                Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Text(
                        "Aún no hay ventas registradas.\nCada vez que pulses \"Nueva venta\"\nse guardará aquí.",
                        fontSize = 16.sp,
                        color = TertiaryLabel,
                        textAlign = TextAlign.Center,
                        lineHeight = 24.sp,
                    )
                }
            } else {
                LazyColumn(
                    Modifier
                        .weight(1f)
                        .widthIn(max = 760.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    items(state.history, key = { it.date }) { day ->
                        DayCard(
                            day = day,
                            onShare = {
                                val intent = Intent(Intent.ACTION_SEND).apply {
                                    type = "text/plain"
                                    putExtra(Intent.EXTRA_TEXT, dayToText(day))
                                }
                                context.startActivity(
                                    Intent.createChooser(intent, "Compartir resumen")
                                )
                            },
                            onDelete = { dayToDelete = day },
                        )
                    }
                }
            }
        }
    }

    dayToDelete?.let { day ->
        AlertDialog(
            onDismissRequest = { dayToDelete = null },
            title = { Text("Borrar ${formatDay(day.date)}") },
            text = { Text("Se eliminará el registro de ventas de ese día. No se puede deshacer.") },
            confirmButton = {
                TextButton(onClick = {
                    state.deleteDay(day.date)
                    dayToDelete = null
                }) { Text("Borrar", color = Red) }
            },
            dismissButton = {
                TextButton(onClick = { dayToDelete = null }) { Text("Cancelar") }
            },
        )
    }
}

@Composable
private fun DayCard(day: DayRecord, onShare: () -> Unit, onDelete: () -> Unit) {
    Surface(shape = RoundedCornerShape(16.dp), color = Color.White, shadowElevation = 1.dp) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(
                        formatDay(day.date),
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = Label,
                    )
                    Text(
                        "${day.salesCount} ${if (day.salesCount == 1) "venta" else "ventas"}",
                        fontSize = 13.sp,
                        color = SecondaryLabel,
                    )
                }
                Text(
                    day.totalCents.asEuros(),
                    fontSize = 26.sp,
                    fontWeight = FontWeight.Bold,
                    color = Label,
                    style = Tabular,
                )
                Spacer(Modifier.width(6.dp))
                IconButton(onClick = onShare) {
                    Icon(Icons.Rounded.Share, contentDescription = "Compartir", tint = Blue)
                }
                IconButton(onClick = onDelete) {
                    Icon(Icons.Rounded.Delete, contentDescription = "Borrar", tint = TertiaryLabel)
                }
            }

            HorizontalDivider(Modifier.padding(vertical = 10.dp), color = Separator)

            day.lines.sortedByDescending { it.units }.forEach { line ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(vertical = 5.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        "${line.emoji} ${line.name}".trim(),
                        fontSize = 16.sp,
                        color = Label,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        "×${line.units}",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = Blue,
                        style = Tabular,
                        modifier = Modifier.width(64.dp),
                        textAlign = TextAlign.End,
                    )
                    Text(
                        line.totalCents.asEuros(),
                        fontSize = 15.sp,
                        color = SecondaryLabel,
                        style = Tabular,
                        modifier = Modifier.width(96.dp),
                        textAlign = TextAlign.End,
                    )
                }
            }
        }
    }
}
