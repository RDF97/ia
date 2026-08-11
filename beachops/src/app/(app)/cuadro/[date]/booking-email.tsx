"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Spinner } from "@/components/submit-button";

type EmailData = {
  booking: {
    customerName: string | null;
    externalRef: string | null;
    channel: string | null;
    source: string;
    activityDate: string;
    activityTime: string | null;
    pax: number;
  };
  email: {
    subject: string | null;
    fromAddress: string | null;
    receivedAt: string | null;
    parseStatus: string;
    html: string | null;
    text: string | null;
  } | null;
  reason?: string;
};

/**
 * Nombre del cliente clicable: abre el email original de la reserva en un
 * recuadro sobre el cuadro, sin salir de él.
 */
export function BookingEmailLink({
  bookingId,
  label,
}: {
  bookingId: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-left underline decoration-dotted underline-offset-2"
        title="Ver el email de esta reserva"
      >
        {label}
      </button>
      {open && <EmailDialog bookingId={bookingId} onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * El email original de la reserva, sobre el cuadro. Se dibuja con un portal en
 * <body> porque quien lo abre es una fila de la tabla: un contenedor fijo
 * dentro de <tbody> no es HTML válido y el navegador lo sacaría de la tabla.
 * El email se pinta dentro de un iframe aislado (traen su propio CSS, que si no
 * se colaría en la página).
 */
export function EmailDialog({
  bookingId,
  onClose,
  actions,
}: {
  bookingId: string;
  onClose: () => void;
  /** Acciones de la reserva (nota, cancelar): formularios de Server Actions. */
  actions?: React.ReactNode;
}) {
  const [data, setData] = useState<EmailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/reservas/${bookingId}/email`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? `Error ${res.status}`);
        return res.json();
      })
      .then((json) => !cancelled && setData(json))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  // Cerrar con Escape, como cualquier modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      // En móvil, hoja que sube desde abajo (patrón iOS); centrada en escritorio.
      className="no-print fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center md:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl safe-bottom md:max-h-[85vh] md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Asa: indica que la hoja se puede cerrar */}
        <div className="flex justify-center pt-2 md:hidden">
          <span className="h-1 w-9 rounded-full bg-slate-300" />
        </div>
        <header className="flex items-start gap-3 border-b border-slate-200 p-3">
          <div className="min-w-0">
            <h2 className="truncate font-bold">
              {data?.email?.subject ?? data?.booking.customerName ?? "Email de la reserva"}
            </h2>
            {data && (
              <p className="truncate text-xs text-slate-500">
                {data.email?.fromAddress ?? data.booking.channel ?? data.booking.source}
                {data.email?.receivedAt &&
                  ` · ${new Date(data.email.receivedAt).toLocaleString("es-ES")}`}
                {data.booking.externalRef && ` · ${data.booking.externalRef}`}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="ml-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 active:bg-slate-100 active:text-slate-700"
            title="Cerrar (Esc)"
          >
            ✕
          </button>
        </header>

        <div className="momentum min-h-40 flex-1 overflow-auto bg-slate-50">
          {error && <p className="p-4 text-sm text-red-600">{error}</p>}
          {!data && !error && (
            <p className="flex items-center gap-2 p-4 text-sm text-slate-500">
              <Spinner /> Cargando el email…
            </p>
          )}
          {data && !data.email && (
            <p className="p-4 text-sm text-slate-500">{data.reason ?? "Sin email de origen."}</p>
          )}
          {data?.email?.html && (
            <iframe
              title="Email de la reserva"
              sandbox=""
              srcDoc={data.email.html}
              className="h-[60vh] w-full border-0 bg-white"
            />
          )}
          {data?.email && !data.email.html && data.email.text && (
            <pre className="whitespace-pre-wrap p-4 text-xs">{data.email.text}</pre>
          )}
        </div>

        {/* Acciones de la reserva: aquí y no en la tabla, para que el cuadro
            siga siendo solo el cuadro y quepa entero en el móvil. */}
        {actions && (
          <footer className="border-t border-slate-200 bg-white p-3">{actions}</footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
