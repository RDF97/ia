import { profileDocId } from "./profiles";

describe("profileDocId · una ficha por persona y hogar", () => {
  const HOGAR = "68a1b2c3d4e5f6a7b8c9"; // 20 caracteres, como los de Appwrite
  const USER = "68f1e2d3c4b5a6978869";

  it("cabe en los 36 caracteres que admite Appwrite", () => {
    expect(profileDocId(HOGAR, USER).length).toBeLessThanOrEqual(36);
  });

  it("solo lleva caracteres que Appwrite acepta y no empieza por símbolo", () => {
    expect(profileDocId(HOGAR, USER)).toMatch(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/);
  });

  it("siempre el mismo para la misma persona: por eso no puede duplicarse", () => {
    expect(profileDocId(HOGAR, USER)).toBe(profileDocId(HOGAR, USER));
  });

  it("distingue a dos personas del mismo hogar", () => {
    expect(profileDocId(HOGAR, USER)).not.toBe(profileDocId(HOGAR, "otrouser0000000000aa"));
  });

  it("distingue el mismo usuario en dos hogares", () => {
    expect(profileDocId(HOGAR, USER)).not.toBe(profileDocId("otrohogar00000000bb", USER));
  });
});
