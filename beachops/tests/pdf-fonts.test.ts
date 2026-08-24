import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * El PDF del cuadro lo dibuja el Chromium de la imagen Docker, y Chromium solo
 * pinta un emoji si el sistema tiene una fuente que lo contenga. Sin ella salen
 * cuadraditos: adiós banderas de país y adiós iconos del estándar visual.
 *
 * Es un fallo silencioso —en local se ve bien, porque el equipo sí tiene la
 * fuente— y solo aparece al abrir el PDF descargado de producción. De ahí este
 * test: `font-noto` (latino + CJK) no incluye emoji, hace falta el paquete de
 * emoji aparte.
 */
describe("la imagen de producción puede dibujar los emoji del cuadro", () => {
  const dockerfile = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");

  it("instala una fuente de emoji junto a Chromium", () => {
    expect(dockerfile).toMatch(/font-noto-emoji|ttf-noto-emoji|NotoColorEmoji/);
  });

  it("y sigue instalando Chromium, que es quien genera el PDF", () => {
    expect(dockerfile).toMatch(/apk add[^\n]*(\\\n[^\n]*)*chromium/);
  });
});
