package com.rdf.tpvevento.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandHorizontally
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkHorizontally
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rdf.tpvevento.PosState
import com.rdf.tpvevento.ProductStore
import com.rdf.tpvevento.ui.theme.Background
import com.rdf.tpvevento.ui.theme.Fill
import com.rdf.tpvevento.ui.theme.Label
import com.rdf.tpvevento.ui.theme.SecondaryLabel

@Composable
fun PosApp(store: ProductStore) {
    val state = remember { PosState(store) }
    var editing by remember { mutableStateOf(false) }

    BoxWithConstraints(
        Modifier
            .fillMaxSize()
            .background(Background)
            .windowInsetsPadding(WindowInsets.safeDrawing)
    ) {
        // Reference canvas the layout was designed on. Tablets with less
        // usable space (e.g. Samsung Tab A9+ vs Xiaomi Pad 6) scale the whole
        // UI down proportionally so all three panels and every money button
        // fit on screen without scrolling.
        val baseDensity = LocalDensity.current
        val scale = minOf(maxWidth / 1100.dp, maxHeight / 700.dp, 1f)
            .coerceAtLeast(0.7f)

        CompositionLocalProvider(
            LocalDensity provides Density(baseDensity.density * scale, baseDensity.fontScale)
        ) {
            Box(Modifier.fillMaxSize()) {
                Column(Modifier.fillMaxSize()) {
                    TopBar(state, onEdit = { editing = true })
                    Row(
                        Modifier
                            .fillMaxSize()
                            .padding(start = 16.dp, end = 16.dp, bottom = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        ProductGrid(state, Modifier.weight(1f))
                        TicketPanel(state, Modifier.width(264.dp))
                        AnimatedVisibility(
                            visible = state.showChange,
                            enter = expandHorizontally(expandFrom = Alignment.Start) + fadeIn(),
                            exit = shrinkHorizontally(shrinkTowards = Alignment.Start) + fadeOut(),
                        ) {
                            ChangePanel(state, Modifier.width(324.dp))
                        }
                    }
                }
                if (editing) {
                    EditProductsScreen(state, onDone = { editing = false })
                }
            }
        }
    }
}

@Composable
private fun TopBar(state: PosState, onEdit: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .height(60.dp)
            .padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "TPV Evento",
            fontSize = 17.sp,
            fontWeight = FontWeight.SemiBold,
            color = Label,
        )
        Spacer(Modifier.weight(1f))
        ModeSwitch(
            showChange = state.showChange,
            onChange = { state.setShowChangePanel(it) },
        )
        Spacer(Modifier.width(12.dp))
        Surface(
            onClick = onEdit,
            shape = RoundedCornerShape(9.dp),
            color = Fill,
        ) {
            Row(
                Modifier.padding(horizontal = 14.dp, vertical = 7.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Icon(
                    Icons.Rounded.Edit,
                    contentDescription = null,
                    tint = Label,
                    modifier = Modifier.height(15.dp),
                )
                Text(
                    "Editar carta",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    color = Label,
                )
            }
        }
    }
}

@Composable
private fun ModeSwitch(showChange: Boolean, onChange: (Boolean) -> Unit) {
    Row(
        Modifier
            .clip(RoundedCornerShape(9.dp))
            .background(Fill)
            .padding(2.dp)
    ) {
        Segment("Solo carta", selected = !showChange) { onChange(false) }
        Segment("Con cambio", selected = showChange) { onChange(true) }
    }
}

@Composable
private fun Segment(label: String, selected: Boolean, onClick: () -> Unit) {
    Box(
        Modifier
            .clip(RoundedCornerShape(7.dp))
            .background(if (selected) androidx.compose.ui.graphics.Color.White else androidx.compose.ui.graphics.Color.Transparent)
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onClick,
            )
            .padding(horizontal = 14.dp, vertical = 6.dp)
    ) {
        Text(
            label,
            fontSize = 13.sp,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
            color = if (selected) Label else SecondaryLabel,
        )
    }
}
