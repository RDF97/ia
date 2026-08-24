import { householdNames, memberLabel, payingMembers, type Member } from "./members";

const M = (p: Partial<Member>): Member => ({
  id: "m",
  userId: "u",
  name: "",
  email: "",
  roles: ["member"],
  joinedAt: "2026-08-01T00:00:00.000Z",
  confirmed: true,
  ...p,
});

describe("payingMembers · quién cuenta para el dinero", () => {
  test("los confirmados con nombre", () => {
    expect(payingMembers([M({ name: "Clara" }), M({ name: "Rubén" })])).toEqual(["Clara", "Rubén"]);
  });

  test("quien no tiene nombre queda fuera", () => {
    // Si entrase, se llevaría su parte de todos los gastos compartidos y saldría
    // un fantasma debiendo dinero sin ningún gasto detrás.
    expect(payingMembers([M({ name: "Clara" }), M({ name: "" })])).toEqual(["Clara"]);
  });

  test("una invitación pendiente todavía no es nadie", () => {
    expect(payingMembers([M({ name: "Clara" }), M({ name: "Ana", confirmed: false })])).toEqual(["Clara"]);
  });

  test("no se repiten nombres", () => {
    expect(payingMembers([M({ name: "Clara" }), M({ id: "m2", name: "Clara" })])).toEqual(["Clara"]);
  });
});

describe("memberLabel · cómo se le llama en pantalla", () => {
  test("el nombre si lo hay", () => {
    expect(memberLabel({ name: "Clara", email: "c@x.com" })).toBe("Clara");
  });

  test("el email si no hay nombre", () => {
    expect(memberLabel({ name: "", email: "c@x.com" })).toBe("c@x.com");
  });

  test("y si no hay nada, se dice claramente", () => {
    expect(memberLabel({ name: "", email: "" })).toBe("Miembro sin nombre");
  });
});

describe("householdNames · a quién se le puede asignar una tarea", () => {
  it("incluye a quien tiene la invitación a medias", () => {
    // Es el caso que rompía "asignar a cualquiera del hogar": Appwrite deja
    // `confirm: false` hasta que se abre el email, aunque la persona ya use la app.
    expect(householdNames([M({ name: "Clara" }), M({ name: "Ana", confirmed: false })])).toEqual([
      "Clara",
      "Ana",
    ]);
  });

  it("sigue dejando fuera a quien no tiene nombre", () => {
    expect(householdNames([M({ name: "Clara" }), M({ name: "" })])).toEqual(["Clara"]);
  });
});
