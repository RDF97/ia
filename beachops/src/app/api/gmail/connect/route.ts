import { NextResponse } from "next/server";
import { getSession } from "@/server/auth";
import { authUrl } from "@/server/gmail/oauth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", process.env.APP_URL));
  return NextResponse.redirect(authUrl(session.orgId));
}
