package com.rdf.tpvevento

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** Units and money sold of one product on a given day. */
data class SaleLine(
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
        return runCatching {
            val arr = JSONArray(raw)
            (0 until arr.length()).map { i ->
                val o = arr.getJSONObject(i)
                val linesArr = o.getJSONArray("lines")
                DayRecord(
                    date = o.getString("date"),
                    salesCount = o.getInt("sales"),
                    totalCents = o.getLong("total"),
                    lines = (0 until linesArr.length()).map { j ->
                        val l = linesArr.getJSONObject(j)
                        SaleLine(
                            emoji = l.optString("emoji"),
                            name = l.getString("name"),
                            units = l.getInt("units"),
                            totalCents = l.getLong("total"),
                        )
                    },
                )
            }
        }.getOrDefault(emptyList())
    }

    fun save(days: List<DayRecord>) {
        val arr = JSONArray()
        days.forEach { d ->
            val lines = JSONArray()
            d.lines.forEach { l ->
                lines.put(
                    JSONObject()
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
