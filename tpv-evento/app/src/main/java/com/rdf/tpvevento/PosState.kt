package com.rdf.tpvevento

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import java.time.LocalDate

/** All the UI state for the point-of-sale screen. */
class PosState(
    private val store: ProductStore,
    private val historyStore: SalesHistoryStore,
) {

    var products by mutableStateOf(store.loadProducts())
        private set

    /** productId -> units in the current ticket. */
    val counts = mutableStateMapOf<String, Int>()

    /** Money handed over by the customer, one entry per tap, in cents. */
    val tendered = mutableStateListOf<Long>()

    var showChange by mutableStateOf(store.showChange)
        private set

    /** Per-day sales history, newest first. */
    var history by mutableStateOf(historyStore.load())
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

    /**
     * Finishes the current customer: records the ticket into today's history
     * (if it has items) and clears the ticket for the next sale. An empty
     * ticket records nothing, so pressing this twice is harmless.
     */
    fun newSale() {
        recordCurrentSale()
        counts.clear()
        tendered.clear()
    }

    private fun recordCurrentSale() {
        val lines = ticketLines
        if (lines.isEmpty()) return

        val today = LocalDate.now().toString()
        val days = history.toMutableList()
        val index = days.indexOfFirst { it.date == today }
        val existing = days.getOrNull(index)

        // Merge today's existing per-product tallies with this ticket.
        val merged = LinkedHashMap<String, SaleLine>()
        existing?.lines?.forEach { merged[it.name] = it }
        for ((product, units) in lines) {
            val addedCents = product.priceCents * units
            val prev = merged[product.name]
            merged[product.name] = if (prev == null) {
                SaleLine(product.emoji, product.name, units, addedCents)
            } else {
                prev.copy(units = prev.units + units, totalCents = prev.totalCents + addedCents)
            }
        }

        val updated = DayRecord(
            date = today,
            salesCount = (existing?.salesCount ?: 0) + 1,
            totalCents = (existing?.totalCents ?: 0) + totalCents,
            lines = merged.values.toList(),
        )
        if (index >= 0) days[index] = updated else days.add(updated)
        // Keep newest first.
        days.sortByDescending { it.date }
        history = days
        historyStore.save(days)
    }

    fun deleteDay(date: String) {
        val updated = history.filterNot { it.date == date }
        history = updated
        historyStore.save(updated)
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
