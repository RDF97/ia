"use client";

import { useEffect, useState } from "react";
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
 * recuadro sobre el cuadro, sin salir de él. El email se pinta dentro de un
 * iframe aislado (traen su propio CSS, que si no se colaría en la página).
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
        className="text-left hover:text-blue-700 hover:underline"
        title="Ver el email de esta reserva"
      >
        {label}
      </button>
      {open && <EmailDialog bookingId={bookingId} onClose={() => setOpen(false)} />}
    </>
  );
}

function EmailDialog({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const [data, setData] = useState<EmailData | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
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
            className="ml-auto rounded px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title="Cerrar (Esc)"
          >
            ✕
          </button>
        </header>

        <div className="min-h-40 flex-1 overflow-auto bg-slate-50">
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
      </div>
    </div>
  );
}
