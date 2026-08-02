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

/** ¿Se puede dictar en este binario? (false en Expo Go). */
export function voiceAvailable(): boolean {
  return load() !== null;
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
  onEnd?: (error?: string) => void;
}): Promise<VoiceSession | null> {
  const mod = load();
  if (!mod) return null;

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
        opts.onEnd?.(ev?.message || ev?.error || "error");
      }),
    );

    mod.start({
      lang: opts.lang ?? "es-ES",
      interimResults: true,
      continuous: false,
      maxAlternatives: 1,
    });
  } catch {
    cleanup();
    opts.onEnd?.("error");
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
