import { householdRoster } from "./roster";

describe("householdRoster · junta los nombres de todas las fuentes", () => {
  it("saca a alguien de los gastos aunque no tenga ficha ni nombre en la membresía", () => {
    // El caso real: Clara con una build vieja, sin ficha publicada, pero con
    // gastos apuntados a su nombre desde hace meses.
    expect(householdRoster("Rubén", { members: [], expenses: [{ paidByName: "Clara" }] })).toEqual([
      "Rubén",
      "Clara",
    ]);
  });

  it("me pone siempre el primero", () => {
    const r = householdRoster("Rubén", { members: ["Clara", "Rubén"] });
    expect(r[0]).toBe("Rubén");
    expect(r).toEqual(["Rubén", "Clara"]);
  });

  it("no repite el mismo nombre escrito de otra forma", () => {
    const r = householdRoster("Rubén", {
      members: ["Clara"],
      expenses: [{ paidByName: "clara" }, { forName: " CLARA " }],
    });
    expect(r).toEqual(["Rubén", "Clara"]);
  });

  it("coge nombres de tareas y de eventos", () => {
    expect(
      householdRoster("Rubén", { tasks: [{ assignedToName: "Ana" }], events: [{ ownerName: "Luis" }] }),
    ).toEqual(["Rubén", "Ana", "Luis"]);
  });

  it("ignora vacíos y nulos", () => {
    expect(
      householdRoster("Rubén", { members: ["", "  "], expenses: [{ paidByName: null, forName: undefined }] }),
    ).toEqual(["Rubén"]);
  });

  it("sin nombre mío, no inventa uno", () => {
    expect(householdRoster("", { members: ["Clara"] })).toEqual(["Clara"]);
  });
});
