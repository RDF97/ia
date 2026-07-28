import { existsSync } from "node:fs";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { getSession } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "2026-07-10" → "cuadro_10julio_2026.pdf" */
function pdfFilename(date: string): string {
  const [y, m, d] = date.split("-");
  const mes = MESES[Number(m) - 1] ?? m;
  return `cuadro_${Number(d)}${mes}_${y}.pdf`;
}

function chromiumExecutablePath(): string | undefined {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  if (existsSync("/opt/pw-browsers/chromium")) return "/opt/pw-browsers/chromium";
  return undefined; // deja que playwright-core resuelva su propia instalación
}

/**
 * Genera el PDF del cuadro diario (instructivo §6). Lanza Chromium headless
 * con Playwright, carga la misma página del cuadro autenticada (reusa el diseño
 * exacto), emula media 'print' (A4, estándar fijo) y devuelve el archivo
 * cuadro_DDmes_2026.pdf para descargar.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> },
) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response("Fecha no válida", { status: 400 });
  }
  const session = await getSession();
  if (!session) return new Response("No autenticado", { status: 401 });

  const origin = new URL(request.url).origin;
  const store = await cookies();
  const sessionCookie = store.get("beachops_session")?.value;

  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({
    executablePath: chromiumExecutablePath(),
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    if (sessionCookie) {
      await context.addCookies([
        { name: "beachops_session", value: sessionCookie, url: origin },
      ]);
    }
    const page = await context.newPage();
    await page.emulateMedia({ media: "print" });
    await page.goto(`${origin}/cuadro/${date}`, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
    });
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pdfFilename(date)}"`,
        "Cache-Control": "no-store",
      },
    });
  } finally {
    await browser.close();
  }
}
