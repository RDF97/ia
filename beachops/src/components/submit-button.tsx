"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * Botón de envío que se explica solo: mientras la acción corre se deshabilita y
 * muestra un spinner ("Procesando…"), y al terminar enseña "✓ Listo" unos
 * segundos. Debe ir DENTRO de un <form> (usa useFormStatus).
 */
export function SubmitButton({
  children,
  className = "",
  pendingLabel = "Procesando…",
  doneLabel = "✓ Listo",
  title,
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  doneLabel?: string;
  title?: string;
}) {
  const { pending } = useFormStatus();
  const [done, setDone] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) {
      setDone(true);
      wasPending.current = pending;
      const timer = setTimeout(() => setDone(false), 3000);
      return () => clearTimeout(timer);
    }
    wasPending.current = pending;
  }, [pending]);

  return (
    <button
      type="submit"
      disabled={pending}
      title={title}
      aria-busy={pending}
      className={`${className} inline-flex items-center gap-1.5 disabled:opacity-70 disabled:cursor-wait`}
    >
      {pending && <Spinner />}
      {pending ? pendingLabel : done ? doneLabel : children}
    </button>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}
