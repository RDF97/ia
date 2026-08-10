package com.rdf.tpvevento

import java.text.NumberFormat
import java.util.Locale

private val euroFormat: NumberFormat =
    NumberFormat.getCurrencyInstance(Locale.forLanguageTag("es-ES"))

/** Formats an amount in cents as "3,50 €". */
fun Long.asEuros(): String = euroFormat.format(this / 100.0)

/** Denominations the customer can hand over, in cents. */
val BILLS = listOf(5000L, 2000L, 1000L, 500L)
val COINS = listOf(200L, 100L, 50L, 20L, 10L, 5L)

/** All denominations used to break down the change to give back. */
private val CHANGE_DENOMS =
    listOf(5000L, 2000L, 1000L, 500L, 200L, 100L, 50L, 20L, 10L, 5L, 2L, 1L)

/** Greedy breakdown of [this] cents into (denomination, count) pairs. */
fun changeBreakdown(cents: Long): List<Pair<Long, Int>> {
    var left = cents
    val out = mutableListOf<Pair<Long, Int>>()
    for (d in CHANGE_DENOMS) {
        if (left <= 0) break
        val n = (left / d).toInt()
        if (n > 0) {
            out += d to n
            left -= d * n
        }
    }
    return out
}

/** Short label for a denomination: "50 €" or "20 c". */
fun denomLabel(cents: Long): String =
    if (cents >= 100) "${cents / 100} €" else "$cents c"

/** Label for an arbitrary tendered amount (exact-amount chip). */
fun tenderLabel(cents: Long): String =
    if (cents in BILLS || cents in COINS) denomLabel(cents) else cents.asEuros()
