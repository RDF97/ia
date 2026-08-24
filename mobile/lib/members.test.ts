import { memberLabel } from "./members";

describe("memberLabel · cómo llamar a alguien cuando no sabemos su nombre", () => {
  it("usa el nombre si lo hay", () => {
    expect(memberLabel({ name: "Clara", email: "clara@x.com" })).toBe("Clara");
  });

  it("cae al email antes que a un texto genérico", () => {
    expect(memberLabel({ name: "", email: "clara@x.com" })).toBe("clara@x.com");
  });

  it("solo inventa etiqueta cuando no hay nada", () => {
    // OJO: este texto es SOLO para la interfaz. No puede entrar en el reparto de
    // gastos como si fuera una persona: eso creaba un fantasma debiendo dinero.
    expect(memberLabel({ name: "", email: "" })).toBe("Miembro sin nombre");
  });
});
