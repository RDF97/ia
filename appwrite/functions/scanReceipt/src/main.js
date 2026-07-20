import { Client, product } from "mindee";

// Función "scanReceipt": recibe una foto de ticket (base64) desde la app, la
// manda a Mindee (Expense Receipts v5) y devuelve comercio, fecha, total y las
// líneas de producto ya estructuradas.
//
// Env var necesaria:
//   MINDEE_API_KEY  → tu API key de mindee.com
//
// Permiso de ejecución: Users (cualquier usuario con sesión).
// Recomendado: timeout de la función ≥ 30 s (Mindee tarda unos segundos).

const num = (f) => (f && typeof f.value === "number" ? f.value : null);
const str = (f) => (f && f.value != null ? String(f.value) : null);

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

    const apiKey = process.env.MINDEE_API_KEY;
    if (!apiKey) return res.json({ ok: false, error: "mindee" }, 500);

    const client = new Client({ apiKey });
    const input = client.docFromBase64(image, "ticket.jpg");
    const resp = await client.parse(product.ReceiptV5, input);
    const p = resp?.document?.inference?.prediction;
    if (!p) return res.json({ ok: false, error: "mindee" }, 502);

    const lines = Array.isArray(p.lineItems)
      ? p.lineItems.map((li) => {
          const total = num(li.totalAmount);
          const unit = typeof li.unitPrice === "number" ? li.unitPrice : num(li.unitPrice);
          const qty = typeof li.quantity === "number" ? li.quantity : num(li.quantity);
          return {
            description: (li.description ?? "").toString().trim(),
            qty: qty ?? null,
            total: total ?? unit ?? null,
          };
        })
      : [];

    const data = {
      merchant: str(p.supplierName),
      date: str(p.date),
      total: num(p.totalAmount),
      currency: p.locale?.currency ?? null,
      lines,
    };

    return res.json({ ok: true, data });
  } catch (e) {
    error(e?.message || String(e));
    return res.json({ ok: false, error: "mindee" }, 500);
  }
};
