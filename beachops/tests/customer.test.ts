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

// Casos que fallaban en producción: el email SÍ traía el nombre pero el cuadro
// salía con "(sin nombre)". Cada uno reproduce una plantilla real distinta.
describe("el nombre no se pierde nunca (regresiones reales)", () => {
  it("nombre pegado al correo relay de la plataforma", () => {
    // Era la causa principal: el candidato contenía "getyourguide" y se
    // descartaba por el propio filtro anti-plataforma.
    const c = parse(
      "<table><tr><td>Main customer</td><td>Ana Torres customer-abc@reply.getyourguide.com</td></tr></table>",
    );
    expect(c.name).toBe("Ana Torres");
    expect(c.email).toBe("customer-abc@reply.getyourguide.com");
  });

  it("etiqueta en negrita y valor en la misma celda, sin dos puntos", () => {
    expect(parse("<table><tr><td><strong>Customer</strong> John Rutter</td></tr></table>").name)
      .toBe("John Rutter");
  });

  it("etiqueta en negrita con dos puntos", () => {
    expect(parse("<table><tr><td><strong>Main customer:</strong> Eva Kanai</td></tr></table>").name)
      .toBe("Eva Kanai");
  });

  it("lista de definición (dl/dt/dd)", () => {
    expect(parse("<dl><dt>Customer name</dt><dd>Imke Mevissen</dd></dl>").name)
      .toBe("Imke Mevissen");
  });

  it("sin ninguna etiqueta: se reconoce el nombre del encabezado", () => {
    expect(parse("<h2>Romina Alladio</h2><p>2 x Adult</p>").name).toBe("Romina Alladio");
  });

  it("no confunde el producto ni el saludo con el cliente", () => {
    expect(parse("<h1>Mallorca: Kayak &amp; Snorkel Tour</h1><p>Guest: Kaya Zom</p>").name)
      .toBe("Kaya Zom");
  });

  it("tabla de datos con cabecera: no confunde la cabecera con el nombre", () => {
    // Antes devolvía "Email" (nombre falso) al leer la fila de cabecera como par.
    const c = parse(
      "<table><tr><th>Name</th><th>Email</th></tr><tr><td>Ana Torres</td><td>ana@x.com</td></tr></table>",
    );
    expect(c.name).toBe("Ana Torres");
  });

  it("tabla sin cabecera: el nombre está en la primera columna", () => {
    expect(parse("<table><tr><td>Ana Torres</td><td>ana@x.com</td></tr></table>").name)
      .toBe("Ana Torres");
  });

  it("no toma una referencia ni un comentario como nombre", () => {
    // "customer" casaba con "customer reference" y devolvía "ABC-99231".
    expect(
      parse(
        "<table><tr><td>Customer reference</td><td>ABC-99231</td></tr><tr><td>Guest names</td><td>Jane Doe</td></tr></table>",
      ).name,
    ).toBe("Jane Doe");
    expect(
      parse(
        "<table><tr><td>Customer comments</td><td>Please bring towels</td></tr><tr><td>Traveller name</td><td>Jane Doe</td></tr></table>",
      ).name,
    ).toBe("Jane Doe");
  });

  it("no rechaza apellidos que contienen palabras de plantilla", () => {
    // "Lena Bookinger" y "Maria Reserva" se descartaban por contener
    // "booking"/"reserva" como subcadena.
    expect(parse("<p>Main customer: Lena Bookinger</p>").name).toBe("Lena Bookinger");
    expect(parse("<p>Main customer: Maria Reserva</p>").name).toBe("Maria Reserva");
    expect(parse("<p>Main customer: Hola Fernandez</p>").name).toBe("Hola Fernandez");
  });

  it("un email pobre sin cliente NO inventa un nombre", () => {
    // "Date July" tiene dos palabras capitalizadas: sin la lista de palabras
    // vetadas se colaba como nombre.
    const c = parse(
      "<h1>Hi SECRET POINT MALLORCA, S.L.U.,</h1><p>You've received a booking.</p><p>Date July 11, 2026</p>",
    );
    expect(c.name).toBeUndefined();
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
