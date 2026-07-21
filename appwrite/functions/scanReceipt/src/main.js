import https from "https";

// Función "scanReceipt": recibe una foto o PDF de un ticket/factura (base64) y lo
// INTERPRETA con Google Gemini (modelo con visión), devolviendo datos ya
// estructurados: comercio, fecha, total, moneda y líneas de producto.
//
// Env vars:
//   GEMINI_API_KEY  → clave gratuita de https://aistudio.google.com/app/apikey
//   GEMINI_MODEL    → opcional; modelo(s) preferido(s), separados por comas.
//                     Si no, prueba una lista de modelos hasta que uno funcione.
//
// Permiso de ejecución: Users. Recomendado timeout ≥ 30 s.

// Se prueban en orden; si uno da 404 (retirado) o 429 (sin cuota), pasa al siguiente.
const DEFAULT_MODELS = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.0-flash-lite", "gemini-2.0-flash"];

const PROMPT = `Eres un experto en leer tickets de compra y facturas de España a partir de una imagen o PDF.
Extrae los datos y devuélvelos SOLO en JSON según el esquema. Reglas:
- "merchant": nombre del comercio/tienda. IGNORA barras de estado del móvil, cabeceras de apps o galerías, y fechas sueltas: no son el comercio.
- "date": fecha de la compra en formato YYYY-MM-DD.
- "total": importe TOTAL pagado, como número.
- "currency": moneda (p. ej. "EUR").
- "lines": SOLO las líneas de productos comprados. Cada una con:
  · "description": nombre del producto, sin códigos ni cantidades sueltas.
  · "qty": unidades compradas de ese producto (número). Si no se indica, usa 1.
  · "unit_price": precio de UNA unidad (número). Ej.: "2 x 4,49  8,98" → unit_price = 4.49.
  · "total": importe de esa línea = qty × unit_price (número). En el ejemplo, 8.98.
  NO incluyas líneas de IVA, subtotales, formas de pago, "entrega", "cambio" ni el total.
Si un dato no aparece, usa null (o lista vacía para lines).`;

const SCHEMA = {
  type: "object",
  properties: {
    merchant: { type: "string", nullable: true },
    date: { type: "string", nullable: true },
    total: { type: "number", nullable: true },
    currency: { type: "string", nullable: true },
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          qty: { type: "number", nullable: true },
          unit_price: { type: "number", nullable: true },
          total: { type: "number", nullable: true },
        },
      },
    },
  },
};

function callGemini(model, base64, mime, apiKey) {
  const payload = JSON.stringify({
    contents: [
      {
        parts: [
          { inline_data: { mime_type: /pdf/i.test(mime) ? "application/pdf" : "image/jpeg", data: base64 } },
          { text: PROMPT },
        ],
      },
    ],
    generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0 },
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "generativelanguage.googleapis.com",
        path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
      },
      (r) => {
        let d = "";
        r.on("data", (c) => (d += c));
        r.on("end", () => resolve(d));
      },
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

export default async ({ req, res, log, error }) => {
  try {
    const userId = req.headers["x-appwrite-user-id"];
    if (!userId) return res.json({ ok: false, error: "auth" }, 401);

    let body = {};
    try {
      body = req.bodyJson ?? (req.body ? JSON.parse(req.body) : {});
    } catch {
      body = {};
    }
    const image = body.image;
    if (!image) return res.json({ ok: false, error: "no-image" }, 400);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.json({ ok: false, error: "no-key" }, 500);

    const mime = body.mime || "image/jpeg";
    const preferred = (process.env.GEMINI_MODEL || "").split(",").map((s) => s.trim()).filter(Boolean);
    const models = [...new Set([...preferred, ...DEFAULT_MODELS])];

    let lastDetail = "sin respuesta";
    for (const model of models) {
      let parsed;
      try {
        parsed = JSON.parse(await callGemini(model, image, mime, apiKey));
      } catch (e) {
        lastDetail = `${model}: ${e?.message || "error red"}`;
        continue;
      }
      if (parsed.error) {
        lastDetail = `${model}: ${parsed.error.code || ""} ${parsed.error.status || parsed.error.message || ""}`.trim();
        log(lastDetail);
        continue; // 404 (retirado) o 429 (sin cuota) → probar siguiente
      }
      const textOut = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textOut) {
        lastDetail = `${model}: respuesta vacía`;
        continue;
      }
      let data;
      try {
        data = JSON.parse(String(textOut).replace(/^```json\s*|\s*```$/g, ""));
      } catch {
        lastDetail = `${model}: JSON inválido`;
        continue;
      }
      const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);
      const lines = Array.isArray(data.lines)
        ? data.lines
            .filter((l) => l && (l.description || l.total != null || l.unit_price != null))
            .map((l) => {
              const qty = num(l.qty);
              const unitPrice = num(l.unit_price);
              let total = num(l.total);
              // Rellena huecos: total = qty × unit; o unit = total / qty.
              if (total == null && unitPrice != null) total = qty != null ? unitPrice * qty : unitPrice;
              return { description: String(l.description ?? "").trim(), qty, unitPrice, total };
            })
        : [];
      log(`OK con modelo ${model}`);
      return res.json({
        ok: true,
        data: {
          merchant: data.merchant ?? null,
          date: data.date ?? null,
          total: typeof data.total === "number" ? data.total : null,
          currency: data.currency ?? null,
          lines,
        },
      });
    }

    error(`Ningún modelo funcionó. Último: ${lastDetail}`);
    return res.json({ ok: false, error: "ocr", detail: lastDetail }, 502);
  } catch (e) {
    error(e?.message || String(e));
    return res.json({ ok: false, error: "ocr" }, 500);
  }
};
