import { Client, Databases, Teams, Query } from "node-appwrite";

// Función "joinHogar": añade al usuario que la ejecuta al hogar (equipo) asociado
// a un código de invitación. Se ejecuta desde la app con la sesión del usuario;
// usa una API key (env APPWRITE_API_KEY) para poder crear la membresía confirmada.
//
// Env vars necesarias:
//   APPWRITE_API_KEY  → API key con scopes: teams.write, databases.read
// (APPWRITE_FUNCTION_API_ENDPOINT y APPWRITE_FUNCTION_PROJECT_ID los inyecta Appwrite)
//
// Permiso de ejecución: Any / Users (cualquier usuario con sesión).

const DB_ID = "homie";
const INVITES_COL = "invites";

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

    const client = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

    const db = new Databases(client);
    const teams = new Teams(client);

    const found = await db.listDocuments({
      databaseId: DB_ID,
      collectionId: INVITES_COL,
      queries: [Query.equal("code", code), Query.limit(1)],
    });
    if (!found.documents.length) return res.json({ ok: false, error: "invalid" }, 404);

    const inv = found.documents[0];
    if (inv.expiresAt && new Date(inv.expiresAt).getTime() < Date.now()) {
      return res.json({ ok: false, error: "expired" }, 410);
    }

    try {
      // Alta server-side por userId → membresía ya confirmada (sin email).
      await teams.createMembership({ teamId: inv.hogarId, roles: ["member"], userId });
    } catch (e) {
      // 409 = ya es miembro → lo tratamos como éxito idempotente.
      const already = e?.code === 409 || String(e?.message || "").toLowerCase().includes("already");
      if (!already) throw e;
    }

    return res.json({ ok: true, hogarName: inv.hogarName });
  } catch (e) {
    error(e?.message || String(e));
    return res.json({ ok: false, error: "server" }, 500);
  }
};
