package com.rdf.tpvevento.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.toMutableStateList
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rdf.tpvevento.PosState
import com.rdf.tpvevento.Product
import com.rdf.tpvevento.ui.theme.Background
import com.rdf.tpvevento.ui.theme.Blue
import com.rdf.tpvevento.ui.theme.Label
import com.rdf.tpvevento.ui.theme.Red
import com.rdf.tpvevento.ui.theme.SecondaryLabel
import com.rdf.tpvevento.ui.theme.Separator
import java.util.Locale
import java.util.UUID
import kotlin.math.roundToLong

/** Mutable editing buffer for one product row. */
private class EditRow(product: Product?) {
    val id: String = product?.id ?: UUID.randomUUID().toString()
    var emoji by mutableStateOf(product?.emoji ?: "")
    var name by mutableStateOf(product?.name ?: "")
    var price by mutableStateOf(
        product?.let { String.format(Locale.forLanguageTag("es-ES"), "%.2f", it.priceCents / 100.0) } ?: ""
    )

    fun toProduct(): Product? {
        val trimmedName = name.trim()
        if (trimmedName.isEmpty()) return null
        val cents = price.trim().replace(',', '.').toDoubleOrNull()?.let { (it * 100).roundToLong() }
        if (cents == null || cents < 0) return null
        return Product(id = id, emoji = emoji.trim(), name = trimmedName, priceCents = cents)
    }
}

@Composable
fun EditProductsScreen(state: PosState, onDone: () -> Unit) {
    val rows = remember { state.products.map { EditRow(it) }.toMutableStateList() }

    Surface(Modifier.fillMaxSize(), color = Background) {
        Column(
            Modifier
                .fillMaxSize()
                .imePadding()
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
                    "Editar carta",
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    color = Label,
                )
                Spacer(Modifier.weight(1f))
                TextButton(onClick = onDone) {
                    Text("Cancelar", fontSize = 15.sp, color = Blue)
                }
                Spacer(Modifier.width(8.dp))
                Button(
                    onClick = {
                        val products = rows.mapNotNull { it.toProduct() }
                        if (products.isNotEmpty()) state.updateProducts(products)
                        onDone()
                    },
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Blue),
                ) {
                    Text("Guardar", fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                }
            }

            Spacer(Modifier.height(12.dp))

            LazyColumn(
                Modifier
                    .weight(1f)
                    .widthIn(max = 760.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(rows, key = { it.id }) { row ->
                    ProductRow(row, onDelete = { rows.remove(row) })
                }
                item {
                    Button(
                        onClick = { rows.add(EditRow(null)) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 4.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Separator,
                            contentColor = Label,
                        ),
                    ) {
                        Icon(Icons.Rounded.Add, contentDescription = null)
                        Spacer(Modifier.width(6.dp))
                        Text("Añadir producto", fontSize = 15.sp, fontWeight = FontWeight.Medium)
                    }
                }
            }
        }
    }
}

@Composable
private fun ProductRow(row: EditRow, onDelete: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = androidx.compose.ui.graphics.Color.White,
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            val fieldColors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Blue,
                unfocusedBorderColor = Separator,
            )
            OutlinedTextField(
                value = row.emoji,
                onValueChange = { row.emoji = it.take(4) },
                modifier = Modifier.width(72.dp),
                singleLine = true,
                placeholder = { Text("🍔", textAlign = TextAlign.Center) },
                textStyle = androidx.compose.ui.text.TextStyle(fontSize = 20.sp, textAlign = TextAlign.Center),
                colors = fieldColors,
            )
            OutlinedTextField(
                value = row.name,
                onValueChange = { row.name = it },
                modifier = Modifier.weight(1f),
                singleLine = true,
                placeholder = { Text("Nombre") },
                textStyle = androidx.compose.ui.text.TextStyle(fontSize = 16.sp),
                colors = fieldColors,
            )
            OutlinedTextField(
                value = row.price,
                onValueChange = { input ->
                    // Allow only digits plus one decimal separator
                    if (input.count { it == ',' || it == '.' } <= 1 &&
                        input.all { it.isDigit() || it == ',' || it == '.' }
                    ) {
                        row.price = input.take(7)
                    }
                },
                modifier = Modifier.width(110.dp),
                singleLine = true,
                placeholder = { Text("0,00") },
                suffix = { Text("€", color = SecondaryLabel) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                textStyle = androidx.compose.ui.text.TextStyle(fontSize = 16.sp, textAlign = TextAlign.End),
                colors = fieldColors,
            )
            IconButton(onClick = onDelete) {
                Icon(Icons.Rounded.Delete, contentDescription = "Eliminar", tint = Red)
            }
        }
    }
}
