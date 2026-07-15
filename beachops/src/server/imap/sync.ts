import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { eq } from "drizzle-orm";
import { decryptSecret } from "../crypto";
import { getDb, schema } from "../db";
import { EmailAccount } from "../db/schema";
import { processRawEmail } from "../ingest/process";

const BACKFILL_DAYS = 30;

function client(account: EmailAccount): ImapFlow {
  if (!account.imapHost || !account.imapPasswordEnc) {
    throw new Error("Cuenta IMAP sin host o contraseña");
  }
  return new ImapFlow({
    host: account.imapHost,
    port: account.imapPort ?? 993,
    secure: (account.imapPort ?? 993) === 993,
    auth: {
      user: account.emailAddress,
      pass: decryptSecret(account.imapPasswordEnc),
    },
    logger: false,
  });
}

/** Prueba de conexión (para el formulario de Config). Lanza si falla. */
export async function testImapConnection(
  host: string,
  port: number,
  user: string,
  password: string,
): Promise<void> {
  const imap = new ImapFlow({
    host,
    port,
    secure: port === 993,
    auth: { user, pass: password },
    logger: false,
  });
  await imap.connect();
  await imap.logout();
}

/**
 * Sincronización incremental por UID: la primera vez importa los últimos
 * 30 días; después, solo UIDs nuevos (> lastUid). Si UIDVALIDITY cambia
 * (el servidor renumeró el buzón), se re-ancla con otro backfill — la
 * idempotencia por Message-ID evita duplicados.
 */
export async function syncImapAccount(account: EmailAccount): Promise<{ ingested: number }> {
  const db = await getDb();
  const imap = client(account);
  await imap.connect();
  let ingested = 0;
  try {
    const mailbox = await imap.mailboxOpen("INBOX", { readOnly: true });
    const uidValidity = String(mailbox.uidValidity ?? "");
    const anchorLost = account.uidValidity !== null && account.uidValidity !== uidValidity;

    let uids: number[];
    if (account.lastUid && !anchorLost) {
      uids = await imap.search({ uid: `${account.lastUid + 1}:*` }, { uid: true }) || [];
      // IMAP devuelve el último mensaje aunque su UID sea <= lastUid
      uids = uids.filter((u) => u > account.lastUid!);
    } else {
      const since = new Date(Date.now() - BACKFILL_DAYS * 24 * 60 * 60 * 1000);
      uids = (await imap.search({ since }, { uid: true })) || [];
    }

    let maxUid = account.lastUid ?? 0;
    for (const uid of uids.sort((a, b) => a - b)) {
      const msg = await imap.fetchOne(String(uid), { source: true }, { uid: true });
      if (!msg || !msg.source) continue;
      maxUid = Math.max(maxUid, uid);
      const parsed = await simpleParser(msg.source);

      const messageId =
        parsed.messageId?.trim() || `imap:${uidValidity}:${uid}@${account.imapHost}`;
      const [raw] = await db
        .insert(schema.rawEmails)
        .values({
          orgId: account.orgId,
          emailAccountId: account.id,
          gmailMessageId: messageId, // id único del mensaje (Message-ID en IMAP)
          fromAddress: parsed.from?.text ?? null,
          subject: parsed.subject ?? null,
          receivedAt: parsed.date ?? null,
          bodyHtml: typeof parsed.html === "string" ? parsed.html : null,
          bodyText: parsed.text ?? null,
        })
        .onConflictDoNothing()
        .returning();
      if (raw) {
        await processRawEmail(raw);
        ingested++;
      }
    }

    await db
      .update(schema.emailAccounts)
      .set({
        lastUid: maxUid,
        uidValidity,
        lastSyncedAt: new Date(),
        syncStatus: "active",
        lastError: null,
      })
      .where(eq(schema.emailAccounts.id, account.id));
  } finally {
    await imap.logout().catch(() => {});
  }
  return { ingested };
}
