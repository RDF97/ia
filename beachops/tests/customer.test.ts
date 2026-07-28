import { describe, expect, it } from "vitest";

import { countryToIso, extractCustomer } from "../src/server/parsers/customer";
import { extractLabeledFields, bestBody, fullText } from "../src/server/parsers/html";
import { gygParser } from "../src/server/parsers/gyg";

function parse(html: string) {
  const fields = extractLabeledFields(html);
  return extractCustomer(fields, fullText(bestBody(html)));
}

describe("datos del cliente en cualquier plantilla", () => {
  it("tabla clásica con bloque 'Main customer'", () => {
    const c = parse(`
      <table><tr><td>Main customer</td><td>Ana Torres<br>Phone: +34 620 788 391<br>Language: Spanish</td></tr></table>
    `);
    expect(c.name).toBe("Ana Torres");
    expect(c.phone).toBe("+34620788391");
    expect(c.country).toBe("ES");
    expect(c.language).toBe("Spanish");
  });

  it("etiquetas sueltas en filas distintas", () => {
    const c = parse(`
      <table>
        <tr><td>Customer name</td><td>John Rutter</td></tr>
        <tr><td>Phone number</td><td>+44 7497 882152</td></tr>
      </table>
    `);
    expect(c.name).toBe("John Rutter");
    expect(c.country).toBe("GB");
  });

  it("SIN tabla: sólo texto corrido (la plantilla que fallaba)", () => {
    const c = parse(`
      <div><p>You have a new booking.</p>
      <p>Nombre: Galiana Thierry</p>
      <p>Teléfono: +33 684 192 556</p></div>
    `);
    expect(c.name).toBe("Galiana Thierry");
    expect(c.phone).toBe("+33684192556");
    expect(c.country).toBe("FR");
  });

  it("teléfono suelto sin etiqueta: se localiza igual y da el país", () => {
    const c = parse(`<div><p>Booking for Imke Mevissen</p><p>Contacto +31 627 314500</p></div>`);
    expect(c.name).toBe("Imke Mevissen");
    expect(c.country).toBe("NL");
  });

  it("país escrito en texto cuando no hay teléfono", () => {
    const c = parse(`
      <table>
        <tr><td>Guest</td><td>Lars Nielsen</td></tr>
        <tr><td>Country</td><td>Dinamarca</td></tr>
      </table>
    `);
    expect(c.name).toBe("Lars Nielsen");
    expect(c.country).toBe("DK");
  });

  it("no confunde el saludo ni la empresa con el nombre del cliente", () => {
    const c = parse(`
      <h1>Hi SECRET POINT MALLORCA, S.L.U.,</h1>
      <p>Nombre: Kaya Zom</p><p>+31 657048440</p>
    `);
    expect(c.name).toBe("Kaya Zom");
  });

  it("prefiere el correo relay del cliente al de soporte", () => {
    const c = parse(`
      <p>support@getyourguide.com</p>
      <p>Main customer: Eva Kanai</p>
      <p>customer-abc@reply.getyourguide.com</p>
    `);
    expect(c.email).toBe("customer-abc@reply.getyourguide.com");
  });

  it("countryToIso entiende nombres en varios idiomas y códigos ISO", () => {
    expect(countryToIso("Alemania")).toBe("DE");
    expect(countryToIso("Germany")).toBe("DE");
    expect(countryToIso("Reino Unido")).toBe("GB");
    expect(countryToIso("Túnez")).toBe("TN");
    expect(countryToIso("ES")).toBe("ES");
    expect(countryToIso("no es un país")).toBeUndefined();
  });
});

describe("el parser de GYG rellena cliente aunque cambie la plantilla", () => {
  it("email sin tabla de cliente: saca nombre, teléfono y país", () => {
    const parsed = gygParser.parse({
      fromAddress: "no-reply@getyourguide.com",
      subject: "Booking - S436088 - GYGNUEVAPLANT",
      bodyHtml: `
        <h1>Mallorca: Kayak Tour</h1>
        <p>Date: July 30, 2026 10:00 AM</p>
        <p>Number of participants: 2 x Adult</p>
        <p>Nombre: Romina Alladio</p>
        <p>Teléfono: +39 366 1107224</p>
      `,
      bodyText: null,
    });
    expect(parsed.customerName).toBe("Romina Alladio");
    expect(parsed.customerPhone).toBe("+393661107224");
    expect(parsed.customerCountry).toBe("IT");
  });
});
