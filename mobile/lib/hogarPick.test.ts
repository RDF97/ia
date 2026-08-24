import { pickHogar } from "./hogarPick";

const H = (id: string, total: number, createdAt = "2026-01-01T00:00:00.000Z") => ({
  $id: id,
  total,
  $createdAt: createdAt,
  name: "Claruchino",
});

describe("pickHogar · con qué hogar se queda la app", () => {
  it("elige el que tiene más gente, no el primero que llegue", () => {
    // El caso real: dos hogares llamados igual, uno con 1 miembro que sobró de
    // una prueba y el bueno con 2. Las fichas estaban solo en el de 2.
    const sobra = H("6a553b64000dd9a70a9d", 1);
    const bueno = H("6a5e7015003daf30afaa", 2);
    expect(pickHogar([sobra, bueno])?.$id).toBe(bueno.$id);
    // Y da igual en qué orden los devuelva Appwrite.
    expect(pickHogar([bueno, sobra])?.$id).toBe(bueno.$id);
  });

  it("a igualdad de gente, el más antiguo", () => {
    const viejo = H("a", 2, "2025-01-01T00:00:00.000Z");
    const nuevo = H("b", 2, "2026-01-01T00:00:00.000Z");
    expect(pickHogar([nuevo, viejo])?.$id).toBe("a");
  });

  it("los dos móviles eligen el mismo aunque el orden difiera", () => {
    const a = H("aaa", 2), b = H("bbb", 2);
    expect(pickHogar([a, b])?.$id).toBe(pickHogar([b, a])?.$id);
  });

  it("sin hogares, ninguno", () => {
    expect(pickHogar([])).toBeNull();
  });

  it("no toca el array que recibe", () => {
    const l = [H("a", 1), H("b", 9)];
    pickHogar(l);
    expect(l.map((h) => h.$id)).toEqual(["a", "b"]);
  });
});
