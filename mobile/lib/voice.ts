/**
 * Dictado por voz (reconocimiento nativo).
 *
 * Usa `expo-speech-recognition`, que es un módulo NATIVO: solo funciona en una
 * build propia (APK/IPA), no en Expo Go. Por eso todo el acceso va detrás de
 * `require` dentro de try/catch: si el módulo no está disponible, la app no
 * rompe y quien llama puede caer en el dictado del teclado.
 */

type Module = {
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  start: (opts: Record<string, unknown>) => void;
  stop: () => void;
  abort?: () => void;
  addListener: (event: string, cb: (e: unknown) => void) => { remove: () => void };
  /** Solo Android: motores de reconocimiento instalados en el móvil. */
  getSpeechRecognitionServices?: () => string[];
  isRecognitionAvailable?: () => boolean;
};

/**
 * Por qué no se pudo dictar. Se devuelve en vez de fallar en silencio: un
 * micrófono que no hace nada al pulsarlo no le dice nada a nadie.
 */
export type VoiceError = "no-module" | "no-engine" | "permiso" | "error";

export const voiceErrorMessage = (err: VoiceError, detail?: string): string => {
  switch (err) {
    case "no-module":
      return "El dictado solo está en la versión instalable (APK), no en Expo Go. Se ha abierto el teclado: usa su micrófono.";
    case "no-engine":
      return "Este móvil no tiene ningún motor de reconocimiento de voz instalado. Instala la app de Google (o actívala en Ajustes → Apps) y vuelve a probar.";
    case "permiso":
      return "Homie necesita permiso de micrófono. Actívalo en Ajustes → Homie → Permisos.";
    default:
      return detail ? `No se pudo dictar: ${detail}` : "No se pudo dictar. Inténtalo otra vez.";
  }
};

function load(): Module | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("expo-speech-recognition");
    return (mod?.ExpoSpeechRecognitionModule as Module) ?? null;
  } catch {
    return null;
  }
}

export interface VoiceSession {
  stop: () => void;
}

/**
 * Empieza a escuchar y va devolviendo lo transcrito.
 * `onResult(text, isFinal)` se llama con resultados parciales y con el final.
 * Devuelve null si no se puede dictar (sin módulo o sin permiso).
 */
export async function startDictation(opts: {
  lang?: string;
  onResult: (text: string, isFinal: boolean) => void;
  onEnd?: (error?: VoiceError, detail?: string) => void;
}): Promise<VoiceSession | null> {
  const mod = load();
  if (!mod) {
    opts.onEnd?.("no-module");
    return null;
  }

  // En Android el reconocimiento lo pone otra app (normalmente la de Google).
  // Si no hay ninguna instalada, `start` no hace nada y el micro parece roto.
  try {
    const services = mod.getSpeechRecognitionServices?.();
    if (Array.isArray(services) && services.length === 0) {
      opts.onEnd?.("no-engine");
      return null;
    }
  } catch {
    /* si no se puede consultar, seguimos e intentamos arrancar igual */
  }

  try {
    const perm = await mod.requestPermissionsAsync();
    if (!perm?.granted) {
      opts.onEnd?.("permiso");
      return null;
    }
  } catch {
    opts.onEnd?.("permiso");
    return null;
  }

  const subs: { remove: () => void }[] = [];
  const cleanup = () => {
    for (const s of subs) {
      try {
        s.remove();
      } catch {
        /* noop */
      }
    }
    subs.length = 0;
  };

  try {
    subs.push(
      mod.addListener("result", (e: unknown) => {
        const ev = e as { results?: { transcript?: string }[]; isFinal?: boolean };
        const text = ev?.results?.[0]?.transcript ?? "";
        if (text) opts.onResult(text, !!ev?.isFinal);
      }),
    );
    subs.push(
      mod.addListener("end", () => {
        cleanup();
        opts.onEnd?.();
      }),
    );
    subs.push(
      mod.addListener("error", (e: unknown) => {
        const ev = e as { error?: string; message?: string };
        cleanup();
        // "no-speech" es que no dijiste nada: no es un fallo que valga la pena contar.
        if (ev?.error === "no-speech") opts.onEnd?.();
        else opts.onEnd?.("error", ev?.message || ev?.error);
      }),
    );

    mod.start({
      lang: opts.lang ?? "es-ES",
      interimResults: true,
      continuous: false,
      maxAlternatives: 1,
    });
  } catch (e) {
    cleanup();
    opts.onEnd?.("error", e instanceof Error ? e.message : undefined);
    return null;
  }

  return {
    stop: () => {
      try {
        mod.stop();
      } catch {
        /* noop */
      }
    },
  };
}
