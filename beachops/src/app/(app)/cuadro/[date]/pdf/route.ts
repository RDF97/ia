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

/** Rutas habituales del Chromium del sistema (Alpine, Debian, sandbox). */
const CHROMIUM_PATHS = [
  "/usr/bin/chromium-browser", // Alpine (paquete `chromium`)
  "/usr/bin/chromium", // Debian/Ubuntu
  "/usr/bin/google-chrome",
  "/opt/pw-browsers/chromium",
];

function chromiumExecutablePath(): string | undefined {
  const fromEnv = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  return CHROMIUM_PATHS.find((p) => existsSync(p));
}

/**
 * Genera el PDF del cuadro diario (instructivo §6). Lanza Chromium headless
 * con Playwright, carga la misma página del cuadro autenticada (reusa el diseño
 * exacto), emula media 'print' (A4, estándar fijo) y devuelve el archivo
 * cuadro_DDmes_2026.pdf para descargar.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ date: string }> },
) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response("Fecha no válida", { status: 400 });
  }
  const session = await getSession();
  if (!session) return new Response("No autenticado", { status: 401 });

  // Se navega al propio servidor por dentro (127.0.0.1), no por el dominio
  // público: así el PDF no depende del proxy, del DNS ni del certificado.
  const origin = `http://127.0.0.1:${process.env.PORT ?? 3000}`;
  const store = await cookies();
  const sessionCookie = store.get("beachops_session")?.value;

  const executablePath = chromiumExecutablePath();
  const { chromium } = await import("playwright-core");
  let browser;
  try {
    browser = await chromium.launch({
      executablePath,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
  } catch (err) {
    console.error("No se pudo arrancar Chromium para el PDF:", err);
    return new Response(
      "No se pudo generar el PDF: falta el navegador en el servidor. " +
        "Reconstruye la imagen (docker compose up -d --build) para instalar Chromium. " +
        "Mientras tanto puedes usar el botón Imprimir → Guardar como PDF.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }
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
  } catch (err) {
    console.error("Falló la generación del PDF:", err);
    return new Response(
      `No se pudo generar el PDF: ${err instanceof Error ? err.message : String(err)}`,
      { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  } finally {
    await browser.close();
  }
}
