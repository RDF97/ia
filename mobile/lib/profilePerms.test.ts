import { profilePerms } from "./profiles";

describe("profilePerms · quién puede leer una ficha", () => {
  const H = "hogar1";
  const YO = "u1";

  it("me deja leer la mía aunque no tenga el rol del equipo", () => {
    // Appwrite no concede `team:` mientras la membresía siga sin confirmar, y
    // sin esto una persona no podía leer ni su propia ficha.
    expect(profilePerms(H, YO, [])).toContain('read("user:u1")');
  });

  it("deja leerla a cada miembro del hogar por su nombre", () => {
    const p = profilePerms(H, YO, ["u1", "u2"]);
    expect(p).toContain('read("user:u2")');
  });

  it("no la abre a cualquiera con cuenta en el servidor", () => {
    // Nombrar a cada persona en vez de usar el rol `users`: si no, cualquiera
    // que se registre en el servidor vería los nombres de la casa.
    expect(profilePerms(H, YO, ["u1", "u2"]).join(" ")).not.toContain('"users"');
  });

  it("no repite permisos aunque me pasen a mí en la lista", () => {
    const p = profilePerms(H, YO, ["u1", "u1", "u2"]);
    expect(p.length).toBe(new Set(p).size);
    expect(p.filter((x) => x === 'read("user:u1")')).toHaveLength(1);
  });

  it("sigue dando los permisos del equipo", () => {
    expect(profilePerms(H, YO, [])).toEqual(expect.arrayContaining([
      'read("team:hogar1")',
      'update("team:hogar1")',
      'delete("team:hogar1")',
    ]));
  });
});
