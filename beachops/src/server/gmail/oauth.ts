import { google } from "googleapis";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../db";
import { decryptSecret, encryptSecret } from "../crypto";

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

export function oauthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  if (!clientId || !clientSecret) {
    throw new Error("Faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET");
  }
  return new google.auth.OAuth2(clientId, clientSecret, `${appUrl}/api/gmail/callback`);
}

/** URL de consentimiento; `state` lleva el orgId firmado por la sesión. */
export function authUrl(state: string): string {
  return oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // fuerza refresh_token también en re-conexiones
    scope: SCOPES,
    state,
  });
}

/** Intercambia el code, guarda la cuenta con el refresh token cifrado. */
export async function handleCallback(orgId: string, code: string): Promise<string> {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error("Google no devolvió refresh_token; reintenta la conexión");
  }
  client.setCredentials(tokens);

  const gmail = google.gmail({ version: "v1", auth: client });
  const profile = await gmail.users.getProfile({ userId: "me" });
  const emailAddress = profile.data.emailAddress ?? "desconocido";
  const historyId = profile.data.historyId ? String(profile.data.historyId) : null;

  const db = await getDb();
  const existing = await db
    .select()
    .from(schema.emailAccounts)
    .where(eq(schema.emailAccounts.orgId, orgId));
  const match = existing.find((a) => a.emailAddress === emailAddress);

  const values = {
    refreshTokenEnc: encryptSecret(tokens.refresh_token),
    lastHistoryId: historyId,
    syncStatus: "active" as const,
    lastError: null,
  };
  if (match) {
    await db
      .update(schema.emailAccounts)
      .set(values)
      .where(eq(schema.emailAccounts.id, match.id));
    return match.id;
  }
  const [row] = await db
    .insert(schema.emailAccounts)
    .values({ orgId, emailAddress, ...values })
    .returning();
  return row.id;
}

/** Cliente autenticado para una cuenta guardada. */
export function gmailClientFor(refreshTokenEnc: string) {
  const client = oauthClient();
  client.setCredentials({ refresh_token: decryptSecret(refreshTokenEnc) });
  return google.gmail({ version: "v1", auth: client });
}
