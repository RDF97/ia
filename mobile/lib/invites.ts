import { ID, Permission, Role } from "react-native-appwrite";
import * as Linking from "expo-linking";
import { functions } from "./appwrite";
import { DB_ID, INVITES_COL, JOIN_FUNCTION_ID, databases } from "./db";

// Alfabeto sin caracteres ambiguos (0/O, 1/I) para códigos fáciles de dictar.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateCode(len = 8): string {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

export interface Invite {
  code: string;
  url: string;
}

/** Crea un código de invitación para el hogar y devuelve el código + enlace profundo. */
export async function createInvite(hogarId: string, hogarName: string, createdByName: string): Promise<Invite> {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(); // 14 días
  await databases.createDocument(
    DB_ID,
    INVITES_COL,
    ID.unique(),
    { code, hogarId, hogarName, createdByName, expiresAt },
    [
      Permission.read(Role.team(hogarId)),
      Permission.update(Role.team(hogarId)),
      Permission.delete(Role.team(hogarId)),
    ],
  );
  const url = Linking.createURL("/join", { queryParams: { code } });
  return { code, url };
}

export interface RedeemResult {
  ok: boolean;
  hogarName?: string;
}

function errorText(code?: string): string {
  switch (code) {
    case "invalid":
      return "Código no válido. Revisa que esté bien escrito.";
    case "expired":
      return "Este código de invitación ha caducado. Pide uno nuevo.";
    case "auth":
      return "Inicia sesión antes de unirte al hogar.";
    case "code":
      return "Falta el código de invitación.";
    default:
      return "No se pudo unir al hogar. Inténtalo de nuevo.";
  }
}

/** Canjea un código llamando a la función del servidor, que añade al usuario al hogar. */
export async function redeemInvite(code: string): Promise<RedeemResult> {
  const clean = code.trim().toUpperCase();
  if (!clean) throw new Error(errorText("code"));
  const exec = await functions.createExecution({
    functionId: JOIN_FUNCTION_ID,
    body: JSON.stringify({ code: clean }),
  });
  let out: { ok?: boolean; error?: string; hogarName?: string } = {};
  try {
    out = JSON.parse(exec.responseBody || "{}");
  } catch {
    /* respuesta no-JSON */
  }
  if (!out.ok) throw new Error(errorText(out.error));
  return { ok: true, hogarName: out.hogarName };
}
