package com.rdf.tpvevento.ui

import android.view.HapticFeedbackConstants
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyGridScope
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
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

@Composable
fun ProductGrid(state: PosState, modifier: Modifier = Modifier) {
    val view = LocalView.current
    val food = state.products.filter { it.category != Product.CATEGORY_DRINK }
    val drinks = state.products.filter { it.category == Product.CATEGORY_DRINK }
    // Only show section headers when both sections have something to separate
    val showHeaders = food.isNotEmpty() && drinks.isNotEmpty()

    LazyVerticalGrid(
        columns = GridCells.Adaptive(minSize = 150.dp),
        modifier = modifier.fillMaxHeight(),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(bottom = 8.dp),
    ) {
        if (showHeaders) sectionHeader("COMIDA")
        productItems(food, state, view)
        if (showHeaders) sectionHeader("BEBIDA")
        productItems(drinks, state, view)
    }
}

private fun LazyGridScope.sectionHeader(title: String) {
    item(key = "header-$title", span = { GridItemSpan(maxLineSpan) }) {
        Text(
            title,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = SecondaryLabel,
            letterSpacing = 1.2.sp,
            modifier = Modifier.padding(start = 4.dp, top = 2.dp),
        )
    }
}

private fun LazyGridScope.productItems(
    products: List<Product>,
    state: PosState,
    view: android.view.View,
) {
    items(products, key = { it.id }) { product ->
        ProductCard(
            product = product,
            count = state.counts[product.id] ?: 0,
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

@Composable
private fun ProductCard(
    product: Product,
    count: Int,
    onAdd: () -> Unit,
    onRemove: () -> Unit,
) {
    Box(Modifier.aspectRatio(1.2f)) {
        Surface(
            onClick = onAdd,
            modifier = Modifier.fillMaxSize(),
            shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
            color = Color.White,
            border = if (count > 0) BorderStroke(2.dp, Blue) else null,
            shadowElevation = 1.dp,
        ) {
            Column(
                Modifier
                    .fillMaxSize()
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                if (product.emoji.isNotBlank()) {
                    Text(product.emoji, fontSize = 30.sp)
                    Spacer(Modifier.height(4.dp))
                }
                Text(
                    product.name,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Label,
                    textAlign = TextAlign.Center,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    lineHeight = 20.sp,
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    product.priceCents.asEuros(),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = SecondaryLabel,
                )
            }
        }
        if (count > 0) {
            Box(
                Modifier
                    .align(Alignment.TopEnd)
                    .padding(8.dp)
                    .size(28.dp)
                    .clip(CircleShape)
                    .background(Blue),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    "$count",
                    color = Color.White,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
            Surface(
                onClick = onRemove,
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(8.dp)
                    .size(28.dp),
                shape = CircleShape,
                color = Fill,
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text("−", fontSize = 17.sp, fontWeight = FontWeight.Bold, color = Label)
                }
            }
        }
    }
}
