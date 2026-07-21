import { generateCode, inviteMessage } from "./invites";

describe("generateCode", () => {
  it("longitud pedida y sin caracteres ambiguos (0/O/1/I)", () => {
    const c = generateCode(8);
    expect(c).toHaveLength(8);
    expect(c).toMatch(/^[A-HJ-NP-Z2-9]+$/);
  });
});

describe("inviteMessage", () => {
  it("con URL de APK: lleva descarga + código", () => {
    const m = inviteMessage("Casa Rubén", "ABCD2345", "https://ej.com/homie.apk");
    expect(m).toContain("Casa Rubén");
    expect(m).toContain("https://ej.com/homie.apk");
    expect(m).toContain("ABCD2345");
    // el enlace de descarga va antes del código
    expect(m.indexOf("homie.apk")).toBeLessThan(m.indexOf("ABCD2345"));
  });

  it("sin URL de APK: solo pide meter el código en la app", () => {
    const m = inviteMessage("Casa Rubén", "ABCD2345", "");
    expect(m).toContain("ABCD2345");
    expect(m).not.toContain("Descarga");
  });
});
