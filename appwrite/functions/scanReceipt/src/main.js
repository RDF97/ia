import https from "https";

// Función "scanReceipt": recibe una foto de ticket (base64) desde la app, la
// manda a OCR.space y devuelve el TEXTO crudo. El parseo (comercio, total,
// líneas) lo hace la app (lib/receipts.ts), así es testeable y se afina sin
// re-desplegar la función.
//
// Env var necesaria:
//   OCR_SPACE_API_KEY  → tu API key gratuita de https://ocr.space/ocrapi
//
// Permiso de ejecución: Users. Recomendado timeout ≥ 30 s.

function ocrSpace(base64, mime, apiKey) {
  const isPdf = /pdf/i.test(mime || "");
  const form = new URLSearchParams();
  form.append("apikey", apiKey);
  form.append("OCREngine", "2"); // motor 2: mejor con recibos, sin idioma fijo
  form.append("isTable", "true");
  form.append("scale", "true");
  form.append("filetype", isPdf ? "PDF" : "JPG");
  form.append("base64Image", `data:${isPdf ? "application/pdf" : "image/jpeg"};base64,${base64}`);
  const body = form.toString();

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.ocr.space",
        path: "/parse/image",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (r) => {
        let d = "";
        r.on("data", (c) => (d += c));
        r.on("end", () => resolve(d));
      },
    );
    req.on("error", reject);
    req.write(body);
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

    const apiKey = process.env.OCR_SPACE_API_KEY;
    if (!apiKey) return res.json({ ok: false, error: "no-key" }, 500);

    const raw = await ocrSpace(image, body.mime || "image/jpeg", apiKey);
    let parsed = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.json({ ok: false, error: "ocr" }, 502);
    }

    if (parsed.IsErroredOnProcessing) {
      error(JSON.stringify(parsed.ErrorMessage || parsed));
      return res.json({ ok: false, error: "ocr" }, 502);
    }
    const text = (parsed.ParsedResults || []).map((p) => p.ParsedText || "").join("\n").trim();
    if (!text) return res.json({ ok: false, error: "ocr" }, 502);

    return res.json({ ok: true, text });
  } catch (e) {
    error(e?.message || String(e));
    return res.json({ ok: false, error: "ocr" }, 500);
  }
};
