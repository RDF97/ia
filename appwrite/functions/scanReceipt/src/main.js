import https from "https";

// Función "scanReceipt": recibe una foto o PDF de un ticket/factura (base64) y lo
// INTERPRETA con Google Gemini (modelo con visión), devolviendo datos ya
// estructurados: comercio, fecha, total, moneda y líneas de producto.
//
// Env vars:
//   GEMINI_API_KEY  → clave gratuita de https://aistudio.google.com/app/apikey
//   GEMINI_MODEL    → opcional; modelo(s) preferido(s), separados por comas.
//                     Es la vía rápida cuando Google retira un modelo: se pone
//                     aquí uno que exista y no hace falta volver a desplegar.
//                     Para ver cuáles hay:
//                       curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=TU_CLAVE" \
//                         | grep -o '"name": "models/[^"]*"'
//                     Si no se pone, se prueba la lista de abajo y, si falla
//                     entera, se le pregunta a la API qué modelos existen hoy.
//
// Permiso de ejecución: Users. Recomendado timeout ≥ 30 s.

// Se prueban en orden; si uno da 404 (retirado) o 429 (sin cuota), pasa al siguiente.
//
// OJO: esta lista CADUCA. Google retira modelos y entonces todos devuelven
// 404 NOT_FOUND y el escáner deja de funcionar de un día para otro sin que
// nadie haya tocado nada. Por eso, si fallan todos, se le pregunta a la propia
// API qué modelos hay disponibles (`descubrirModelos`) y se reintenta con ellos.
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

// Tope por modelo. Sin esto, un modelo que se cuelga se lleva por delante todo
// el tiempo de la función y el usuario ve una respuesta vacía sin explicación.
const MODEL_TIMEOUT_MS = 25_000;

/** GET sencillo, para preguntarle a la API qué modelos existen. */
function httpGet(path) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: "generativelanguage.googleapis.com", path, method: "GET" },
      (r) => {
        let d = "";
        r.on("data", (c) => (d += c));
        r.on("end", () => resolve(d));
      },
    );
    req.setTimeout(10_000, () => req.destroy(new Error("sin respuesta al listar modelos")));
    req.on("error", reject);
    req.end();
  });
}

/**
 * Pregunta a Gemini qué modelos hay ahora mismo y devuelve los que sirven para
 * esto: los que aceptan `generateContent`, dejando fuera embeddings, imagen y
 * audio. Se prefieren los "flash" (rápidos y baratos) sobre los "pro".
 */
async function descubrirModelos(apiKey) {
  const raw = await httpGet(`/v1beta/models?key=${apiKey}&pageSize=100`);
  const parsed = JSON.parse(raw);
  if (parsed.error) {
    const e = new Error(`${parsed.error.code || ""} ${parsed.error.status || parsed.error.message || ""}`.trim());
    e.apiError = true;
    throw e;
  }
  const nombres = (parsed.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
    .map((m) => String(m.name || "").replace(/^models\//, ""))
    .filter((n) => n && !/embedding|aqa|image|imagen|tts|audio|veo|learnlm/i.test(n));

  const peso = (n) => (/flash/i.test(n) ? 0 : /pro/i.test(n) ? 1 : 2);
  return nombres.sort((a, b) => peso(a) - peso(b) || a.localeCompare(b));
}

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
    req.setTimeout(MODEL_TIMEOUT_MS, () => {
      req.destroy(new Error(`sin respuesta en ${MODEL_TIMEOUT_MS / 1000} s`));
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

/** Tamaño aproximado en KB de una cadena base64, para poder decirlo si falla. */
const kb = (b64) => Math.round((b64.length * 3) / 4 / 1024);

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
    if (!apiKey) {
      return res.json(
        { ok: false, error: "no-key", detail: "La variable GEMINI_API_KEY no está puesta en la función." },
        500,
      );
    }

    const mime = body.mime || "image/jpeg";
    const preferred = (process.env.GEMINI_MODEL || "").split(",").map((s) => s.trim()).filter(Boolean);
    const models = [...new Set([...preferred, ...DEFAULT_MODELS])];

    let lastDetail = "sin respuesta";
    const probados = [];
    // Se recorre la lista con un índice porque, si todos fallan por 404, se le
    // añaden al vuelo los modelos que la API diga que existen ahora.
    let descubiertos = false;
    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      probados.push(model);
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
        // Si se acabó la lista escrita a mano y todo fueron fallos, se le
        // pregunta a la API qué modelos existen HOY y se reintenta con ellos.
        // Sin esto, el día que Google retira un modelo el escáner muere y hay
        // que redesplegar la función para revivirlo.
        if (!descubiertos && i === models.length - 1) {
          descubiertos = true;
          try {
            const vivos = await descubrirModelos(apiKey);
            const nuevos = vivos.filter((m) => !models.includes(m)).slice(0, 3);
            if (nuevos.length) {
              log(`Modelos disponibles ahora: ${vivos.slice(0, 8).join(", ")}`);
              models.push(...nuevos);
            } else {
              lastDetail += ` · la API no ofrece ningún modelo con generateContent`;
            }
          } catch (e) {
            // Si ni siquiera se puede listar, el problema es la clave, no el modelo.
            lastDetail = e?.apiError
              ? `no se pudieron listar los modelos (${e.message}). Revisa GEMINI_API_KEY.`
              : `${lastDetail} · fallo al listar modelos: ${e?.message || e}`;
          }
        }
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
      log(`OK con modelo ${model}${probados.length > 1 ? ` (tras probar ${probados.length})` : ""}`);
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

    const resumen = `Probados: ${probados.join(", ")}. Último fallo → ${lastDetail}. Imagen ~${kb(image)} KB.`;
    error(`Ningún modelo funcionó. ${resumen}`);
    return res.json({ ok: false, error: "ocr", detail: resumen }, 502);
  } catch (e) {
    const detail = e?.message || String(e);
    error(detail);
    return res.json({ ok: false, error: "ocr", detail }, 500);
  }
};
