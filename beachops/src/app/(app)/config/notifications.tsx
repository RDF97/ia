"use client";

import { useEffect, useState } from "react";
import {
  deletePushSubscription,
  savePushSubscription,
  sendTestPush,
} from "@/server/actions";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type State = "unsupported" | "no-vapid" | "off" | "on" | "working";

export function NotificationSettings({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [state, setState] = useState<State>("working");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!vapidPublicKey) return setState("no-vapid");
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return setState("unsupported");
    }
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("unsupported"));
  }, [vapidPublicKey]);

  async function enable() {
    setState("working");
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("Has denegado el permiso de notificaciones en el navegador.");
        return setState("off");
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey!) as BufferSource,
      });
      const json = sub.toJSON();
      await savePushSubscription({
        endpoint: sub.endpoint,
        p256dh: json.keys!.p256dh,
        auth: json.keys!.auth,
        userAgent: navigator.userAgent,
      });
      setState("on");
      setMessage("Notificaciones activadas en este dispositivo.");
    } catch (err) {
      setMessage(`No se pudo activar: ${String(err)}`);
      setState("off");
    }
  }

  async function disable() {
    setState("working");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await deletePushSubscription(sub.endpoint);
      await sub.unsubscribe();
    }
    setState("off");
    setMessage("Notificaciones desactivadas en este dispositivo.");
  }

  if (state === "no-vapid") {
    return (
      <p className="text-sm text-slate-500">
        Faltan las claves VAPID en el servidor (<code>VAPID_PUBLIC_KEY</code> /{" "}
        <code>VAPID_PRIVATE_KEY</code>). Genéralas con{" "}
        <code>npx web-push generate-vapid-keys</code> y reinicia.
      </p>
    );
  }
  if (state === "unsupported") {
    return (
      <p className="text-sm text-slate-500">
        Este navegador no soporta notificaciones push. En iPhone: añade primero la app a la
        pantalla de inicio (Compartir → &quot;Añadir a pantalla de inicio&quot;) y actívalas desde ahí.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {state === "on" ? (
          <>
            <button
              onClick={disable}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-sm hover:bg-slate-100"
            >
              Desactivar en este dispositivo
            </button>
            <button
              onClick={async () => {
                await sendTestPush();
                setMessage("Notificación de prueba enviada.");
              }}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-sm hover:bg-slate-100"
            >
              Enviar prueba
            </button>
          </>
        ) : (
          <button
            onClick={enable}
            disabled={state === "working"}
            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {state === "working" ? "…" : "Activar notificaciones en este dispositivo"}
          </button>
        )}
      </div>
      {message && <p className="text-xs text-slate-500">{message}</p>}
      <p className="text-xs text-slate-400">
        Avisa de: nueva reserva, cancelación, franja sobre-reservada y emails sin procesar.
        En iPhone requiere tener la app añadida a la pantalla de inicio (iOS 16.4+).
      </p>
    </div>
  );
}
