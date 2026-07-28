import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "beachops_session";

export type Session = {
  userId: string;
  orgId: string;
  email: string;
  name: string;
  role: string;
};

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("Falta AUTH_SECRET");
  return new TextEncoder().encode(s);
}

export async function createSessionCookie(session: Session) {
  const jwt = await new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
  const store = await cookies();
  store.set(COOKIE, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const jwt = store.get(COOKIE)?.value;
  if (!jwt) return null;
  try {
    const { payload } = await jwtVerify(jwt, secret());
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

/** Para páginas/actions protegidas: sesión o redirect a /login. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
