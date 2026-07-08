package com.rdf.tpvevento

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

data class Product(
    val id: String = UUID.randomUUID().toString(),
    val emoji: String,
    val name: String,
    val priceCents: Long,
    val category: String = CATEGORY_FOOD,
) {
    companion object {
        const val CATEGORY_FOOD = "food"
        const val CATEGORY_DRINK = "drink"
    }
}

val DEFAULT_PRODUCTS = listOf(
    Product(emoji = "🥪", name = "Bocadillo", priceCents = 350),
    Product(emoji = "🍔", name = "Hamburguesa", priceCents = 450),
    Product(emoji = "🌭", name = "Perrito", priceCents = 350),
    Product(emoji = "🍢", name = "Pincho", priceCents = 250),
    Product(emoji = "🍟", name = "Patatas", priceCents = 200),
    Product(emoji = "🍺", name = "Cerveza", priceCents = 200, category = Product.CATEGORY_DRINK),
    Product(emoji = "🥤", name = "Refresco", priceCents = 150, category = Product.CATEGORY_DRINK),
    Product(emoji = "💧", name = "Agua", priceCents = 100, category = Product.CATEGORY_DRINK),
    Product(emoji = "🍷", name = "Vino", priceCents = 150, category = Product.CATEGORY_DRINK),
    Product(emoji = "☕", name = "Café", priceCents = 120, category = Product.CATEGORY_DRINK),
)

/** Persists the product list and UI preferences in SharedPreferences. */
class ProductStore(context: Context) {
    private val prefs = context.getSharedPreferences("tpv", Context.MODE_PRIVATE)

    fun loadProducts(): List<Product> {
        val raw = prefs.getString("products", null) ?: return DEFAULT_PRODUCTS
        return runCatching {
            val arr = JSONArray(raw)
            (0 until arr.length()).map { i ->
                val o = arr.getJSONObject(i)
                Product(
                    id = o.getString("id"),
                    emoji = o.optString("emoji"),
                    name = o.getString("name"),
                    priceCents = o.getLong("price"),
                    category = o.optString("cat", Product.CATEGORY_FOOD),
                )
            }
        }.getOrDefault(DEFAULT_PRODUCTS)
    }

    fun saveProducts(products: List<Product>) {
        val arr = JSONArray()
        products.forEach { p ->
            arr.put(
                JSONObject()
                    .put("id", p.id)
                    .put("emoji", p.emoji)
                    .put("name", p.name)
                    .put("price", p.priceCents)
                    .put("cat", p.category)
            )
        }
        prefs.edit().putString("products", arr.toString()).apply()
    }

    var showChange: Boolean
        get() = prefs.getBoolean("show_change", true)
        set(value) {
            prefs.edit().putBoolean("show_change", value).apply()
        }
}
