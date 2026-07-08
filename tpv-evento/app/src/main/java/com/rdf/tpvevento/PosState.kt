package com.rdf.tpvevento

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

/** All the UI state for the point-of-sale screen. */
class PosState(private val store: ProductStore) {

    var products by mutableStateOf(store.loadProducts())
        private set

    /** productId -> units in the current ticket. */
    val counts = mutableStateMapOf<String, Int>()

    /** Money handed over by the customer, one entry per tap, in cents. */
    val tendered = mutableStateListOf<Long>()

    var showChange by mutableStateOf(store.showChange)
        private set

    val totalCents: Long
        get() = products.sumOf { (counts[it.id] ?: 0) * it.priceCents }

    val tenderedCents: Long
        get() = tendered.sum()

    val ticketLines: List<Pair<Product, Int>>
        get() = products.mapNotNull { p ->
            counts[p.id]?.takeIf { it > 0 }?.let { p to it }
        }

    val itemCount: Int
        get() = ticketLines.sumOf { it.second }

    fun add(product: Product) {
        counts[product.id] = (counts[product.id] ?: 0) + 1
    }

    fun remove(product: Product) {
        val c = counts[product.id] ?: return
        if (c <= 1) counts.remove(product.id) else counts[product.id] = c - 1
    }

    fun addTender(cents: Long) {
        tendered += cents
    }

    fun removeTenderAt(index: Int) {
        if (index in tendered.indices) tendered.removeAt(index)
    }

    fun payExact() {
        tendered.clear()
        if (totalCents > 0) tendered += totalCents
    }

    fun clearTender() = tendered.clear()

    fun newSale() {
        counts.clear()
        tendered.clear()
    }

    fun setShowChangePanel(value: Boolean) {
        showChange = value
        store.showChange = value
    }

    fun updateProducts(newProducts: List<Product>) {
        products = newProducts
        val ids = newProducts.map { it.id }.toSet()
        counts.keys.retainAll(ids)
        store.saveProducts(newProducts)
    }
}
