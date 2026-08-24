import { mergeMembers, memberLabel, payingMembers, type Member } from "./members";

type Membership = Omit<Member, "icon" | "iconColor">;

const M = (p: Partial<Membership>): Membership => ({
  id: "m",
  userId: "u1",
  name: "",
  email: "",
  roles: ["member"],
  joinedAt: "2026-08-01T00:00:00.000Z",
  confirmed: true,
  ...p,
});

describe("mergeMembers · el nombre bueno es el de la ficha del hogar", () => {
  test("Appwrite devuelve el nombre vacío y la ficha lo rellena", () => {
    // Este es el caso real: `teams.listMemberships` no expone userName/userEmail
    // a la app, así que sin ficha todos salían como "Miembro sin nombre".
    const out = mergeMembers([M({ userId: "u1" })], [{ userId: "u1", name: "Clara" }]);
    expect(out[0].name).toBe("Clara");
  });

  test("la ficha manda sobre lo que traiga Appwrite", () => {
    const out = mergeMembers([M({ userId: "u1", name: "viejo" })], [{ userId: "u1", name: "Rubén" }]);
    expect(out[0].name).toBe("Rubén");
  });

  test("sin ficha se conserva lo que hubiera (respaldo)", () => {
    const out = mergeMembers([M({ userId: "u1", name: "correo" })], []);
    expect(out[0].name).toBe("correo");
  });

  test("cada ficha va a su persona, no se cruzan", () => {
    const out = mergeMembers(
      [M({ id: "a", userId: "u1" }), M({ id: "b", userId: "u2" })],
      [
        { userId: "u2", name: "Clara" },
        { userId: "u1", name: "Rubén" },
      ],
    );
    expect(out.map((m) => m.name)).toEqual(["Rubén", "Clara"]);
  });

  test("se arrastran icono y color para verlos en la lista", () => {
    const out = mergeMembers(
      [M({ userId: "u1" })],
      [{ userId: "u1", name: "Clara", icon: "heart", iconColor: "#FF2D55" }],
    );
    expect(out[0]).toMatchObject({ icon: "heart", iconColor: "#FF2D55" });
  });

  test("quien todavía no tiene ficha no entra en el reparto de gastos", () => {
    const out = mergeMembers(
      [M({ id: "a", userId: "u1" }), M({ id: "b", userId: "u2" })],
      [{ userId: "u1", name: "Rubén" }],
    );
    expect(payingMembers(out)).toEqual(["Rubén"]);
    expect(memberLabel(out[1])).toBe("Miembro sin nombre");
  });
});

describe("mergeMembers · tener ficha demuestra que estás dentro", () => {
  it("da por confirmado a quien ha publicado su ficha", () => {
    const out = mergeMembers(
      [M({ userId: "u2", name: "", confirmed: false })],
      [{ userId: "u2", name: "Clara", icon: null, iconColor: null }],
    );
    expect(out[0].confirmed).toBe(true);
    expect(payingMembers(out)).toEqual(["Clara"]);
  });

  it("no confirma a quien no tiene ficha", () => {
    const out = mergeMembers([M({ userId: "u3", name: "Ana", confirmed: false })], []);
    expect(out[0].confirmed).toBe(false);
  });
});
