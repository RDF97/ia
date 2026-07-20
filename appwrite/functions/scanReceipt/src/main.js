import https from "https";

// Función "scanReceipt": recibe una foto o PDF de un ticket/factura (base64) y lo
// INTERPRETA con Google Gemini (modelo con visión), devolviendo datos ya
// estructurados: comercio, fecha, total, moneda y líneas de producto.
//
// Env vars:
//   GEMINI_API_KEY  → clave gratuita de https://aistudio.google.com/app/apikey
//   GEMINI_MODEL    → opcional, por defecto "gemini-2.0-flash"
//
// Permiso de ejecución: Users. Recomendado timeout ≥ 30 s.

const PROMPT = `Eres un experto en leer tickets de compra y facturas de España a partir de una imagen o PDF.
Extrae los datos y devuélvelos SOLO en JSON según el esquema. Reglas:
- "merchant": nombre del comercio/tienda. IGNORA barras de estado del móvil, cabeceras de apps o galerías, y fechas sueltas: no son el comercio.
- "date": fecha de la compra en formato YYYY-MM-DD.
- "total": importe TOTAL pagado, como número.
- "currency": moneda (p. ej. "EUR").
- "lines": SOLO las líneas de productos comprados. Cada una con "description" (nombre del producto, sin códigos ni cantidades sueltas) y "total" (precio de esa línea, número). NO incluyas líneas de IVA, subtotales, formas de pago, "entrega", "cambio" ni el total.
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
          total: { type: "number", nullable: true },
        },
      },
    },
  },
};

function gemini(base64, mime, apiKey, model) {
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
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    const raw = await gemini(image, body.mime || "image/jpeg", apiKey, model);
    let parsed = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.json({ ok: false, error: "ocr" }, 502);
    }
    if (parsed.error) {
      error(JSON.stringify(parsed.error));
      return res.json({ ok: false, error: "ocr" }, 502);
    }

    const textOut = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOut) return res.json({ ok: false, error: "ocr" }, 502);

    let data = {};
    try {
      data = JSON.parse(String(textOut).replace(/^```json\s*|\s*```$/g, ""));
    } catch {
      return res.json({ ok: false, error: "ocr" }, 502);
    }

    const lines = Array.isArray(data.lines)
      ? data.lines
          .filter((l) => l && (l.description || l.total != null))
          .map((l) => ({ description: String(l.description ?? "").trim(), qty: null, total: typeof l.total === "number" ? l.total : null }))
      : [];

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
  } catch (e) {
    error(e?.message || String(e));
    return res.json({ ok: false, error: "ocr" }, 500);
  }
};
