"use client";

import { useState } from "react";
import { EmailDialog } from "./booking-email";

/** Columnas del cuadro: Pax · Nombre · País · Teléfono · Referencia · Pago. */
export const COLS = 6;

/**
 * Fila de reserva del cuadro. Toda la fila es tocable: al pulsarla se abre el
 * email original de esa reserva sobre el cuadro (es lo que se necesita en la
 * playa cuando algo no cuadra), con sus acciones —nota y cancelar— al pie.
 * El teléfono es la única excepción: llama en vez de abrir el email.
 *
 * Las acciones llegan como `children` desde el servidor porque son formularios
 * de Server Actions; aquí solo se llevan a la hoja del email. Mantenerlas fuera
 * de la tabla es lo que deja el cuadro completo dentro de un iPhone.
 */
export function FilaReserva({
  bookingId,
  tint,
  pax,
  nombre,
  flag,
  phone,
  reference,
  payment,
  children,
  childCount = 0,
  note,
  aviso = false,
}: {
  bookingId: string;
  /** Tinte de la fila según el canal (directa / instagram / hotel). */
  tint?: string;
  pax: number;
  nombre: string;
  flag?: string;
  phone?: string | null;
  reference?: string | null;
  payment: React.ReactNode;
  children?: React.ReactNode;
  childCount?: number;
  note?: string | null;
  aviso?: boolean;
}) {
  const [email, setEmail] = useState(false);
  const abrir = () => setEmail(true);

  return (
    <>
      <tr
        className={`fila ${aviso ? "fila-aviso" : tint ?? ""}`}
        onClick={abrir}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            abrir();
          }
        }}
        tabIndex={0}
        role="button"
        title="Ver el email de esta reserva"
      >
        <td className="pax-n">{pax}</td>
        <td>{nombre}</td>
        <td>{flag}</td>
        <td className="tel">
          {phone && (
            <a href={`tel:${phone}`} onClick={(e) => e.stopPropagation()}>
              {phone}
            </a>
          )}
        </td>
        <td className="col-ref ref">{reference}</td>
        <td>{payment}</td>
      </tr>

      {/* Los niños salen en su propia fila morada, como en el cuadro impreso */}
      {childCount > 0 && (
        <tr className={`fila nino ${aviso ? "fila-aviso" : ""}`} onClick={abrir}>
          <td className="pax-n">+{childCount}</td>
          <td className="nombre-nino" colSpan={2}>
            {childCount === 1 ? "Niño" : `${childCount} niños`} ({nombre})
          </td>
          <td className="tel" />
          <td className="col-ref ref">chaleco talla niño</td>
          <td />
        </tr>
      )}

      {note && (
        <tr className="nota-row" onClick={abrir}>
          <td colSpan={COLS} className="nota-fila">
            📝 {note}
          </td>
        </tr>
      )}

      {email && (
        <EmailDialog bookingId={bookingId} onClose={() => setEmail(false)} actions={children} />
      )}
    </>
  );
}
