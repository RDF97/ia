import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/server/auth";
import { getDb, schema } from "@/server/db";
import { handleCallback } from "@/server/gmail/oauth";
import { syncAccount } from "@/server/gmail/sync";

export async function GET(req: NextRequest) {
  const session = await getSession();
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  if (!session) return NextResponse.redirect(new URL("/login", appUrl));

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code || state !== session.orgId) {
    return NextResponse.redirect(new URL("/config?error=oauth", appUrl));
  }

  try {
    const accountId = await handleCallback(session.orgId, code);
    // Backfill inicial (último mes) en el momento de conectar.
    const db = await getDb();
    const [account] = await db
      .select()
      .from(schema.emailAccounts)
      .where(eq(schema.emailAccounts.id, accountId));
    await db
      .update(schema.emailAccounts)
      .set({ lastHistoryId: null })
      .where(eq(schema.emailAccounts.id, accountId));
    await syncAccount({ ...account, lastHistoryId: null });
    return NextResponse.redirect(new URL("/config?connected=1", appUrl));
  } catch (err) {
    console.error("Callback de Gmail falló:", err);
    return NextResponse.redirect(new URL("/config?error=oauth", appUrl));
  }
}
