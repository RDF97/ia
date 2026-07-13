import { gmail_v1 } from "googleapis";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../db";
import { EmailAccount } from "../db/schema";
import { processRawEmail } from "../ingest/process";
import { gmailClientFor } from "./oauth";

/** Query del backfill inicial: solo remitentes de reservas, último mes. */
const BACKFILL_QUERY = "newer_than:30d (from:getyourguide.com OR from:bokun.io)";

/**
 * Sincroniza una cuenta: incremental via history.list desde el último
 * historyId; si Google lo ha caducado (404), backfill por messages.list.
 * Cada mensaje se inserta de forma idempotente y se procesa.
 */
export async function syncAccount(account: EmailAccount): Promise<{ ingested: number }> {
  const db = await getDb();
  if (!account.refreshTokenEnc) return { ingested: 0 };
  const gmail = gmailClientFor(account.refreshTokenEnc);

  let messageIds: string[] = [];
  let newHistoryId: string | null = account.lastHistoryId;

  try {
    if (account.lastHistoryId) {
      const result = await listHistory(gmail, account.lastHistoryId);
      messageIds = result.messageIds;
      newHistoryId = result.historyId ?? newHistoryId;
    } else {
      messageIds = await listBackfill(gmail);
      const profile = await gmail.users.getProfile({ userId: "me" });
      newHistoryId = profile.data.historyId ? String(profile.data.historyId) : null;
    }
  } catch (err: unknown) {
    if (isHttpStatus(err, 404)) {
      // historyId demasiado antiguo: re-anclar con un backfill corto
      messageIds = await listBackfill(gmail, "newer_than:7d");
      const profile = await gmail.users.getProfile({ userId: "me" });
      newHistoryId = profile.data.historyId ? String(profile.data.historyId) : null;
    } else {
      throw err;
    }
  }

  let ingested = 0;
  for (const id of messageIds) {
    const inserted = await ingestMessage(gmail, account, id);
    if (inserted) ingested++;
  }

  await db
    .update(schema.emailAccounts)
    .set({
      lastHistoryId: newHistoryId,
      lastSyncedAt: new Date(),
      syncStatus: "active",
      lastError: null,
    })
    .where(eq(schema.emailAccounts.id, account.id));

  return { ingested };
}

async function listHistory(
  gmail: gmail_v1.Gmail,
  startHistoryId: string,
): Promise<{ messageIds: string[]; historyId: string | null }> {
  const ids = new Set<string>();
  let pageToken: string | undefined;
  let historyId: string | null = null;
  do {
    const res = await gmail.users.history.list({
      userId: "me",
      startHistoryId,
      historyTypes: ["messageAdded"],
      pageToken,
    });
    historyId = res.data.historyId ? String(res.data.historyId) : historyId;
    for (const h of res.data.history ?? []) {
      for (const m of h.messagesAdded ?? []) {
        if (m.message?.id) ids.add(m.message.id);
      }
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return { messageIds: [...ids], historyId };
}

async function listBackfill(gmail: gmail_v1.Gmail, q = BACKFILL_QUERY): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const res = await gmail.users.messages.list({ userId: "me", q, pageToken, maxResults: 100 });
    for (const m of res.data.messages ?? []) if (m.id) ids.push(m.id);
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return ids;
}

/** Descarga un mensaje y lo guarda+procesa. Devuelve false si ya existía. */
async function ingestMessage(
  gmail: gmail_v1.Gmail,
  account: EmailAccount,
  messageId: string,
): Promise<boolean> {
  const db = await getDb();
  const res = await gmail.users.messages.get({ userId: "me", id: messageId, format: "full" });
  const msg = res.data;
  const headers = Object.fromEntries(
    (msg.payload?.headers ?? []).map((h) => [h.name?.toLowerCase() ?? "", h.value ?? ""]),
  );
  const { html, text } = extractBodies(msg.payload);

  const [raw] = await db
    .insert(schema.rawEmails)
    .values({
      orgId: account.orgId,
      emailAccountId: account.id,
      gmailMessageId: messageId,
      gmailThreadId: msg.threadId ?? null,
      fromAddress: headers["from"] ?? null,
      subject: headers["subject"] ?? null,
      receivedAt: msg.internalDate ? new Date(Number(msg.internalDate)) : null,
      bodyHtml: html,
      bodyText: text,
    })
    .onConflictDoNothing()
    .returning();
  if (!raw) return false;
  await processRawEmail(raw);
  return true;
}

/** Recorre el árbol MIME buscando las partes text/html y text/plain. */
function extractBodies(payload: gmail_v1.Schema$MessagePart | undefined): {
  html: string | null;
  text: string | null;
} {
  let html: string | null = null;
  let text: string | null = null;
  const walk = (part: gmail_v1.Schema$MessagePart | undefined) => {
    if (!part) return;
    const data = part.body?.data;
    if (data) {
      const decoded = Buffer.from(data, "base64url").toString("utf8");
      if (part.mimeType === "text/html" && !html) html = decoded;
      if (part.mimeType === "text/plain" && !text) text = decoded;
    }
    for (const child of part.parts ?? []) walk(child);
  };
  walk(payload);
  return { html, text };
}

function isHttpStatus(err: unknown, status: number): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    ("code" in err ? (err as { code?: number }).code === status : false)
  );
}

/** Sincroniza todas las cuentas activas (lo llama el worker y el botón manual). */
export async function syncAllAccounts(): Promise<void> {
  const db = await getDb();
  const accounts = await db
    .select()
    .from(schema.emailAccounts)
    .where(eq(schema.emailAccounts.syncStatus, "active"));
  for (const account of accounts) {
    try {
      await syncAccount(account);
    } catch (err) {
      await db
        .update(schema.emailAccounts)
        .set({ syncStatus: "error", lastError: String(err) })
        .where(eq(schema.emailAccounts.id, account.id));
      console.error(`Sync falló para ${account.emailAddress}:`, err);
    }
  }
}
