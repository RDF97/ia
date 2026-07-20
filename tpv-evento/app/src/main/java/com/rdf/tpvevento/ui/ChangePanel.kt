package com.rdf.tpvevento.ui

import android.view.HapticFeedbackConstants
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rdf.tpvevento.BILLS
import com.rdf.tpvevento.COINS
import com.rdf.tpvevento.PosState
import com.rdf.tpvevento.asEuros
import com.rdf.tpvevento.changeBreakdown
import com.rdf.tpvevento.denomLabel
import com.rdf.tpvevento.tenderLabel
import com.rdf.tpvevento.ui.theme.Blue
import com.rdf.tpvevento.ui.theme.Fill
import com.rdf.tpvevento.ui.theme.Green
import com.rdf.tpvevento.ui.theme.Label
import com.rdf.tpvevento.ui.theme.Orange
import com.rdf.tpvevento.ui.theme.SecondaryLabel
import com.rdf.tpvevento.ui.theme.TertiaryLabel

private val Tabular = TextStyle(fontFeatureSettings = "tnum")

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ChangePanel(state: PosState, modifier: Modifier = Modifier) {
    val view = LocalView.current
    val tap = { view.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY) }

    Surface(
        modifier = modifier.fillMaxHeight(),
        shape = RoundedCornerShape(20.dp),
        color = Color.White,
        shadowElevation = 1.dp,
    ) {
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
        ) {
            // Total / Entregado
            Row(Modifier.fillMaxWidth()) {
                Column(Modifier.weight(1f)) {
                    Text("Total", fontSize = 13.sp, fontWeight = FontWeight.Medium, color = SecondaryLabel)
                    Text(
                        state.totalCents.asEuros(),
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold,
                        color = Label,
                        style = Tabular,
                    )
                }
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.End) {
                    Text("Entregado", fontSize = 13.sp, fontWeight = FontWeight.Medium, color = SecondaryLabel)
                    Text(
                        state.tenderedCents.asEuros(),
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (state.tendered.isEmpty()) TertiaryLabel else Blue,
                        style = Tabular,
                    )
                }
            }

            // Chips of what the customer handed over (tap one to remove it).
            // The row is always present with a fixed height so the money
            // buttons below never shift when the first chip appears; extra
            // chips scroll horizontally instead of wrapping.
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp)
                    .height(30.dp)
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                state.tendered.forEachIndexed { index, cents ->
                    Surface(
                        onClick = {
                            tap()
                            state.removeTenderAt(index)
                        },
                        shape = RoundedCornerShape(8.dp),
                        color = Fill,
                    ) {
                        Row(
                            Modifier.padding(horizontal = 9.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(5.dp),
                        ) {
                            Text(
                                tenderLabel(cents),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium,
                                color = Label,
                            )
                            Text("✕", fontSize = 11.sp, color = TertiaryLabel)
                        }
                    }
                }
            }

            Spacer(Modifier.height(12.dp))

            // Bills
            BILLS.chunked(2).forEach { row ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(bottom = 10.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    row.forEach { denom ->
                        BillButton(denom, Modifier.weight(1f)) {
                            tap()
                            state.addTender(denom)
                        }
                    }
                }
            }

            Spacer(Modifier.height(2.dp))

            // Coins
            COINS.chunked(3).forEach { row ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(bottom = 10.dp),
                ) {
                    row.forEach { denom ->
                        Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
                            CoinButton(denom) {
                                tap()
                                state.addTender(denom)
                            }
                        }
                    }
                }
            }

            // Exact amount / clear
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Surface(
                    onClick = {
                        tap()
                        state.payExact()
                    },
                    modifier = Modifier
                        .weight(1f)
                        .height(40.dp),
                    shape = RoundedCornerShape(10.dp),
                    color = Fill,
                    enabled = state.totalCents > 0,
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(
                            "Importe justo",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (state.totalCents > 0) Label else TertiaryLabel,
                        )
                    }
                }
                Surface(
                    onClick = {
                        tap()
                        state.clearTender()
                    },
                    modifier = Modifier
                        .weight(1f)
                        .height(40.dp),
                    shape = RoundedCornerShape(10.dp),
                    color = Fill,
                    enabled = state.tendered.isNotEmpty(),
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(
                            "Borrar",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (state.tendered.isNotEmpty()) Label else TertiaryLabel,
                        )
                    }
                }
            }

            Spacer(Modifier.height(16.dp))

            ResultArea(state)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ResultArea(state: PosState) {
    val diff = state.tenderedCents - state.totalCents
    Column(
        Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        when {
            state.tendered.isEmpty() -> {
                Text(
                    "Marca lo que entrega el cliente",
                    fontSize = 14.sp,
                    color = TertiaryLabel,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(vertical = 12.dp),
                )
            }
            diff >= 0 -> {
                Text(
                    "CAMBIO",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = SecondaryLabel,
                    letterSpacing = 1.5.sp,
                )
                Text(
                    diff.asEuros(),
                    fontSize = 46.sp,
                    fontWeight = FontWeight.Bold,
                    color = Green,
                    style = Tabular,
                )
                if (diff > 0) {
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier.padding(top = 4.dp),
                    ) {
                        changeBreakdown(diff).forEach { (denom, n) ->
                            Box(
                                Modifier
                                    .background(Fill, RoundedCornerShape(8.dp))
                                    .padding(horizontal = 9.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    "$n × ${denomLabel(denom)}",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = Label,
                                )
                            }
                        }
                    }
                } else {
                    Text(
                        "Importe justo ✓",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                        color = Green,
                    )
                }
            }
            else -> {
                Text(
                    "FALTAN",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = SecondaryLabel,
                    letterSpacing = 1.5.sp,
                )
                Text(
                    (-diff).asEuros(),
                    fontSize = 40.sp,
                    fontWeight = FontWeight.Bold,
                    color = Orange,
                    style = Tabular,
                )
            }
        }
    }
}

// ---- Money buttons -------------------------------------------------------

private fun billColors(denom: Long): Pair<Color, Color> = when (denom) {
    5000L -> Color(0xFFEFB65C) to Color(0xFFDD9A33) // orange
    2000L -> Color(0xFF6C9BD2) to Color(0xFF4A78B5) // blue
    1000L -> Color(0xFFCE7A6B) to Color(0xFFB25746) // red
    else -> Color(0xFF9DA6A6) to Color(0xFF7E8C8C)  // 5 € grey-green
}

@Composable
private fun BillButton(denom: Long, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val (light, dark) = billColors(denom)
    Surface(
        onClick = onClick,
        modifier = modifier.height(52.dp),
        shape = RoundedCornerShape(8.dp),
        color = Color.Transparent,
    ) {
        Box(
            Modifier
                .fillMaxSize()
                .background(Brush.linearGradient(listOf(light, dark))),
            contentAlignment = Alignment.Center,
        ) {
            Row(verticalAlignment = Alignment.Bottom) {
                Text(
                    "${denom / 100}",
                    fontSize = 23.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                )
                Spacer(Modifier.width(3.dp))
                Text(
                    "€",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White.copy(alpha = 0.85f),
                    modifier = Modifier.padding(bottom = 3.dp),
                )
            }
        }
    }
}

private val SilverLight = Color(0xFFD9DCE0)
private val SilverDark = Color(0xFFB9BEC4)
private val GoldLight = Color(0xFFE7C05A)
private val GoldDark = Color(0xFFCFA23B)
private val CopperLight = Color(0xFFC08552)
private val CopperDark = Color(0xFFA05E36)

@Composable
private fun CoinButton(denom: Long, onClick: () -> Unit) {
    val size = if (denom >= 100) 58.dp else 54.dp
    Surface(
        onClick = onClick,
        modifier = Modifier.size(size),
        shape = CircleShape,
        color = Color.Transparent,
    ) {
        val (outerLight, outerDark, inner) = when (denom) {
            200L -> Triple(SilverLight, SilverDark, GoldLight)      // 2 €: silver ring, gold core
            100L -> Triple(GoldLight, GoldDark, SilverLight)        // 1 €: gold ring, silver core
            5L -> Triple(CopperLight, CopperDark, Color.Transparent)
            else -> Triple(GoldLight, GoldDark, Color.Transparent)  // 50/20/10 c: nordic gold
        }
        Box(
            Modifier
                .fillMaxSize()
                .background(Brush.linearGradient(listOf(outerLight, outerDark))),
            contentAlignment = Alignment.Center,
        ) {
            if (inner != Color.Transparent) {
                Box(
                    Modifier
                        .size(size * 0.62f)
                        .background(inner, CircleShape)
                )
            }
            val textColor = when (denom) {
                200L, 100L, 5L -> if (denom == 5L) Color.White else Color(0xFF5A4A20)
                else -> Color(0xFF5A4A20)
            }
            Row(verticalAlignment = Alignment.Bottom) {
                Text(
                    if (denom >= 100) "${denom / 100}" else "$denom",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = textColor,
                )
                Spacer(Modifier.width(2.dp))
                Text(
                    if (denom >= 100) "€" else "c",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = textColor.copy(alpha = 0.8f),
                    modifier = Modifier.padding(bottom = 2.dp),
                )
            }
        }
    }
}
