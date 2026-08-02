import https from "https";
import { URL } from "url";

// Función "joinHogar": añade al usuario que la ejecuta al hogar (equipo) asociado
// a un código de invitación.
//
// SIN DEPENDENCIAS a propósito: usa el módulo `https` de Node contra la API REST
// de Appwrite. Así el despliegue por .tar.gz funciona aunque no se ejecute
// `npm install` — que es justo lo que rompía la versión anterior (importaba
// node-appwrite y, sin node_modules, la función fallaba al arrancar). De paso
// evita los cambios de firma entre versiones del SDK.
//
// Variables necesarias:
//   APPWRITE_API_KEY  → API key con scopes teams.write y databases.read
// (APPWRITE_FUNCTION_API_ENDPOINT y APPWRITE_FUNCTION_PROJECT_ID los inyecta Appwrite)
//
// Permiso de ejecución: Users.

const DB_ID = "homie";
const INVITES_COL = "invites";

/** Petición JSON a la API de Appwrite. Devuelve { status, body }. */
function api(method, path, cfg, payload) {
  const url = new URL(cfg.endpoint.replace(/\/$/, "") + path);
  const data = payload ? JSON.stringify(payload) : null;
  const headers = {
    "X-Appwrite-Project": cfg.project,
    "X-Appwrite-Key": cfg.key,
    "Content-Type": "application/json",
  };
  if (data) headers["Content-Length"] = Buffer.byteLength(data);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method,
        headers,
      },
      (r) => {
        let raw = "";
        r.on("data", (c) => (raw += c));
        r.on("end", () => {
          let body = {};
          try {
            body = raw ? JSON.parse(raw) : {};
          } catch {
            body = { message: raw.slice(0, 200) };
          }
          resolve({ status: r.statusCode || 0, body });
        });
      },
    );
    req.on("error", reject);
    if (data) req.write(data);
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
    const code = String(body.code || "").trim().toUpperCase();
    if (!code) return res.json({ ok: false, error: "code" }, 400);

    const cfg = {
      endpoint: process.env.APPWRITE_FUNCTION_API_ENDPOINT,
      project: process.env.APPWRITE_FUNCTION_PROJECT_ID,
      key: process.env.APPWRITE_API_KEY,
    };
    if (!cfg.key) {
      error("Falta la variable APPWRITE_API_KEY en la función");
      return res.json({ ok: false, error: "no-key" }, 500);
    }

    // 1) Buscar el código de invitación.
    const q = encodeURIComponent(
      JSON.stringify({ method: "equal", attribute: "code", values: [code] }),
    );
    const found = await api(
      "GET",
      `/databases/${DB_ID}/collections/${INVITES_COL}/documents?queries[]=${q}`,
      cfg,
    );
    if (found.status >= 400) {
      const detail = found.body?.message || `HTTP ${found.status}`;
      error(`No se pudo leer invites: ${detail}`);
      return res.json({ ok: false, error: "lookup", detail: String(detail).slice(0, 300) }, 500);
    }

    const docs = found.body?.documents ?? [];
    if (!docs.length) return res.json({ ok: false, error: "invalid" }, 404);

    const inv = docs[0];
    if (inv.expiresAt && new Date(inv.expiresAt).getTime() < Date.now()) {
      return res.json({ ok: false, error: "expired" }, 410);
    }

    // 2) Alta directa por userId → membresía ya confirmada (sin email).
    const made = await api("POST", `/teams/${inv.hogarId}/memberships`, cfg, {
      userId,
      roles: ["member"],
    });

    // 409 = ya es miembro → éxito idempotente.
    if (made.status >= 400 && made.status !== 409) {
      const detail = made.body?.message || `HTTP ${made.status}`;
      error(`Alta en el equipo falló: ${detail}`);
      return res.json({ ok: false, error: "membership", detail: String(detail).slice(0, 300) }, 500);
    }

    log(`Usuario ${userId} añadido al hogar ${inv.hogarId}`);
    return res.json({ ok: true, hogarName: inv.hogarName });
  } catch (e) {
    error(e?.message || String(e));
    return res.json({ ok: false, error: "server", detail: String(e?.message || e).slice(0, 300) }, 500);
  }
};
