/**
 * Parche para un fallo del SDK de Appwrite que dejaba la app en blanco.
 *
 * `react-native-appwrite` mantiene vivo el canal de tiempo real mandando un
 * "ping" por el WebSocket cada 20 segundos, pero NO comprueba que el socket
 * esté conectado antes de mandarlo (dist/cjs/sdk.js, `createHeartbeat`):
 *
 *     setInterval(() => { this.realtime.socket?.send('{"type":"ping"}') }, 20000)
 *
 * En React Native, `WebSocket.send()` lanza `Error("INVALID_STATE_ERR")` si el
 * socket todavía está en CONNECTING (Libraries/WebSocket/WebSocket.js). Eso pasa
 * justo al volver del segundo plano: el socket se cayó, se está reconectando, y
 * el ping llega en medio. Como el error sale de un temporizador y no del pintado,
 * React no lo ve: el hilo de JavaScript muere y la pantalla se queda en blanco
 * hasta forzar el cierre.
 *
 * Aquí se envuelve `send` y `ping` para que, mientras el socket esté conectando,
 * no hagan nada en vez de lanzar. Perder un ping no tiene coste: el SDK ya
 * reconecta solo, y el siguiente sale 20 segundos después con el socket abierto.
 *
 * Se puede quitar cuando el SDK compruebe el estado (su otra implementación de
 * tiempo real, más nueva, sí lo hace: `readyState === WebSocket.OPEN`).
 */

let installed = false;

export function installRealtimeGuard(): void {
  if (installed) return;
  const WS = (globalThis as unknown as { WebSocket?: typeof WebSocket }).WebSocket;
  if (!WS?.prototype) return;
  installed = true;

  const proto = WS.prototype as unknown as {
    send: (...args: unknown[]) => void;
    ping?: () => void;
    __homieGuarded?: boolean;
  };
  if (proto.__homieGuarded) return;
  proto.__homieGuarded = true;

  const CONNECTING = (WS as unknown as { CONNECTING: number }).CONNECTING ?? 0;

  const originalSend = proto.send;
  proto.send = function guardedSend(this: WebSocket, ...args: unknown[]) {
    if (this.readyState === CONNECTING) return;
    return originalSend.apply(this, args);
  };

  if (typeof proto.ping === "function") {
    const originalPing = proto.ping;
    proto.ping = function guardedPing(this: WebSocket) {
      if (this.readyState === CONNECTING) return;
      return originalPing.apply(this);
    };
  }
}
