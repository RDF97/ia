import { installRealtimeGuard } from "./realtimeGuard";

/** WebSocket de mentira que se comporta como el de React Native. */
class FakeWS {
  static CONNECTING = 0;
  static OPEN = 1;
  readyState = FakeWS.CONNECTING;
  sent: string[] = [];
  pinged = 0;

  send(data: string) {
    // Igual que Libraries/WebSocket/WebSocket.js: lanza si aún está conectando.
    if (this.readyState === FakeWS.CONNECTING) throw new Error("INVALID_STATE_ERR");
    this.sent.push(data);
  }
  ping() {
    if (this.readyState === FakeWS.CONNECTING) throw new Error("INVALID_STATE_ERR");
    this.pinged++;
  }
}

describe("installRealtimeGuard", () => {
  beforeAll(() => {
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = FakeWS;
    installRealtimeGuard();
  });

  it("un ping sobre un socket que aún conecta ya no tumba la app", () => {
    // Este es el fallo real: el SDK de Appwrite manda un ping cada 20 s sin
    // mirar el estado, y al volver del segundo plano cae mientras reconecta.
    const ws = new FakeWS();
    expect(() => ws.send('{"type":"ping"}')).not.toThrow();
    expect(ws.sent).toEqual([]);
  });

  it("con el socket abierto sí se manda", () => {
    const ws = new FakeWS();
    ws.readyState = FakeWS.OPEN;
    ws.send("hola");
    expect(ws.sent).toEqual(["hola"]);
  });

  it("lo mismo con ping()", () => {
    const conectando = new FakeWS();
    expect(() => conectando.ping()).not.toThrow();
    expect(conectando.pinged).toBe(0);

    const abierto = new FakeWS();
    abierto.readyState = FakeWS.OPEN;
    abierto.ping();
    expect(abierto.pinged).toBe(1);
  });

  it("instalarlo dos veces no envuelve dos veces", () => {
    installRealtimeGuard();
    const ws = new FakeWS();
    ws.readyState = FakeWS.OPEN;
    ws.send("a");
    expect(ws.sent).toEqual(["a"]);
  });
});
