import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

/**
 * Detecta componentes que se renderizan a sí mismos.
 *
 * Un componente cuyo JSX de vuelta es él mismo se llama sin parar: la pila se
 * desborda y el hilo de JS muere. En pantalla no es un error, es la app
 * congelada. Pasó de verdad: `SectionTitle` en la pestaña de Luz quedó así
 * durante el repaso de interfaz, y bloqueaba la pestaña entera al abrirla.
 *
 * Se comprueba aquí porque los tres filtros de siempre lo dejan pasar: es
 * TypeScript válido (tsc lo acepta), no hay test que lo renderice, y
 * `expo export` empaqueta sin ejecutar. Nada mira lo que ocurre al pintar.
 */

const RAIZ = join(__dirname, "..");

function tsx(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e.startsWith(".")) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...tsx(p));
    else if (e.endsWith(".tsx")) out.push(p);
  }
  return out;
}

/**
 * Cuerpo de la función que empieza en `desde`.
 *
 * Hay que saltarse antes la lista de parámetros: en `function X({ children })`
 * la primera llave es la del destructuring, no la del cuerpo, y quedarse con
 * ella hacía que este test no encontrara nada nunca.
 */
function cuerpo(src: string, desde: number): string {
  const abre = src.indexOf("(", desde);
  if (abre < 0) return "";
  let par = 0;
  let trasParams = -1;
  for (let i = abre; i < src.length; i++) {
    if (src[i] === "(") par++;
    else if (src[i] === ")" && --par === 0) {
      trasParams = i;
      break;
    }
  }
  if (trasParams < 0) return "";
  const ini = src.indexOf("{", trasParams);
  if (ini < 0) return "";
  let nivel = 0;
  for (let i = ini; i < src.length; i++) {
    if (src[i] === "{") nivel++;
    else if (src[i] === "}" && --nivel === 0) return src.slice(ini, i + 1);
  }
  return src.slice(ini);
}

describe("ningún componente se renderiza a sí mismo", () => {
  const archivos = [...tsx(join(RAIZ, "app")), ...tsx(join(RAIZ, "components"))];

  it("hay pantallas que revisar", () => {
    expect(archivos.length).toBeGreaterThan(5);
  });

  it.each(archivos.map((f) => [f.slice(RAIZ.length + 1), f]))("%s", (_nombre, ruta) => {
    const src = readFileSync(ruta as string, "utf8");
    const culpables: string[] = [];
    for (const m of src.matchAll(/(?:export\s+)?function\s+([A-Z]\w*)\s*[(<]/g)) {
      const nombre = m[1];
      // Solo dentro de SU propio cuerpo: si no, un componente que use a otro
      // definido más abajo en el archivo daría un falso positivo.
      if (new RegExp(`<${nombre}[\\s/>]`).test(cuerpo(src, m.index!))) culpables.push(nombre);
    }
    expect(culpables).toEqual([]);
  });
});
