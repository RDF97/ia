package com.rdf.tpvevento.ui

import android.view.HapticFeedbackConstants
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rdf.tpvevento.PosState
import com.rdf.tpvevento.Product
import com.rdf.tpvevento.asEuros
import com.rdf.tpvevento.ui.theme.Blue
import com.rdf.tpvevento.ui.theme.Fill
import com.rdf.tpvevento.ui.theme.Label
import com.rdf.tpvevento.ui.theme.SecondaryLabel
import com.rdf.tpvevento.ui.theme.Separator
import com.rdf.tpvevento.ui.theme.TertiaryLabel

private val Tabular = TextStyle(fontFeatureSettings = "tnum")

@Composable
fun TicketPanel(state: PosState, modifier: Modifier = Modifier) {
    val view = LocalView.current
    Surface(
        modifier = modifier.fillMaxHeight(),
        shape = RoundedCornerShape(20.dp),
        color = Color.White,
        shadowElevation = 1.dp,
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "Ticket",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = SecondaryLabel,
                )
                Spacer(Modifier.weight(1f))
                if (state.itemCount > 0) {
                    Text(
                        "${state.itemCount} art.",
                        fontSize = 13.sp,
                        color = TertiaryLabel,
                    )
                }
            }
            if (state.ticketLines.isEmpty()) {
                Box(
                    Modifier
                        .weight(1f)
                        .fillMaxWidth(),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        "Pulsa un producto\npara añadirlo",
                        fontSize = 15.sp,
                        color = TertiaryLabel,
                        textAlign = TextAlign.Center,
                        lineHeight = 22.sp,
                    )
                }
            } else {
                LazyColumn(
                    Modifier
                        .weight(1f)
                        .padding(top = 8.dp),
                ) {
                    items(state.ticketLines, key = { it.first.id }) { (product, count) ->
                        TicketLine(
                            product = product,
                            count = count,
                            onAdd = {
                                view.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
                                state.add(product)
                            },
                            onRemove = {
                                view.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
                                state.remove(product)
                            },
                        )
                    }
                }
            }
            HorizontalDivider(color = Separator)
            Row(
                Modifier.padding(top = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "Total",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Label,
                )
                Spacer(Modifier.weight(1f))
                Text(
                    state.totalCents.asEuros(),
                    fontSize = 32.sp,
                    fontWeight = FontWeight.Bold,
                    color = Label,
                    style = Tabular,
                )
            }
            Spacer(Modifier.height(12.dp))
            Button(
                onClick = {
                    view.performHapticFeedback(HapticFeedbackConstants.CONFIRM)
                    state.newSale()
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                enabled = state.itemCount > 0 || state.tendered.isNotEmpty(),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Blue,
                    disabledContainerColor = Fill,
                    disabledContentColor = TertiaryLabel,
                ),
            ) {
                Text("Nueva venta", fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
private fun TicketLine(
    product: Product,
    count: Int,
    onAdd: () -> Unit,
    onRemove: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        StepperButton("−", onRemove)
        Text(
            "$count",
            modifier = Modifier.width(28.dp),
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
            color = Blue,
            textAlign = TextAlign.Center,
            style = Tabular,
        )
        StepperButton("+", onAdd)
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(
                product.name,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                color = Label,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                (count * product.priceCents).asEuros(),
                fontSize = 13.sp,
                color = SecondaryLabel,
                style = Tabular,
            )
        }
    }
}

@Composable
private fun StepperButton(symbol: String, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        modifier = Modifier.size(28.dp),
        shape = CircleShape,
        color = Fill,
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(symbol, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Label)
        }
    }
}
