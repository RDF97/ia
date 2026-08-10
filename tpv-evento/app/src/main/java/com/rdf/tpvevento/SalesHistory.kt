package com.rdf.tpvevento

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Units and money sold of one product on a given day. Keyed by the stable
 * product [id] so tallies stay correct even if the product is later renamed
 * or another product shares its name; [emoji]/[name] are the label captured
 * at sale time (refreshed to the latest on each new sale of the same id).
 */
data class SaleLine(
    val id: String,
    val emoji: String,
    val name: String,
    val units: Int,
    val totalCents: Long,
)

/** Everything sold on one calendar day. `date` is ISO yyyy-MM-dd. */
data class DayRecord(
    val date: String,
    val salesCount: Int,
    val totalCents: Long,
    val lines: List<SaleLine>,
)

/**
 * Persists the per-day sales history as JSON in the same prefs file as the
 * products. Fully local: no accounts, no network.
 */
class SalesHistoryStore(context: Context) {
    private val prefs = context.getSharedPreferences("tpv", Context.MODE_PRIVATE)

    fun load(): List<DayRecord> {
        val raw = prefs.getString("history", null) ?: return emptyList()
        val arr = runCatching { JSONArray(raw) }.getOrNull() ?: return emptyList()
        // Parse each day independently so a single malformed record can never
        // wipe the whole history.
        return (0 until arr.length()).mapNotNull { i ->
            runCatching {
                val o = arr.getJSONObject(i)
                val linesArr = o.getJSONArray("lines")
                DayRecord(
                    date = o.getString("date"),
                    salesCount = o.getInt("sales"),
                    totalCents = o.getLong("total"),
                    lines = (0 until linesArr.length()).map { j ->
                        val l = linesArr.getJSONObject(j)
                        val name = l.getString("name")
                        SaleLine(
                            // Fall back to name for any pre-id records.
                            id = l.optString("id", name),
                            emoji = l.optString("emoji"),
                            name = name,
                            units = l.getInt("units"),
                            totalCents = l.getLong("total"),
                        )
                    },
                )
            }.getOrNull()
        }
    }

    fun save(days: List<DayRecord>) {
        val arr = JSONArray()
        days.forEach { d ->
            val lines = JSONArray()
            d.lines.forEach { l ->
                lines.put(
                    JSONObject()
                        .put("id", l.id)
                        .put("emoji", l.emoji)
                        .put("name", l.name)
                        .put("units", l.units)
                        .put("total", l.totalCents)
                )
            }
            arr.put(
                JSONObject()
                    .put("date", d.date)
                    .put("sales", d.salesCount)
                    .put("total", d.totalCents)
                    .put("lines", lines)
            )
        }
        prefs.edit().putString("history", arr.toString()).apply()
    }
}
