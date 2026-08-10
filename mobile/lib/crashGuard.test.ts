import { installCrashGuard, onFatal } from "./crashGuard";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    setItem: jest.fn().mockResolvedValue(undefined),
    getItem: jest.fn().mockResolvedValue(null),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

type Handler = (error: unknown, isFatal?: boolean) => void;

describe("crashGuard · errores fuera del pintado", () => {
  let handler: Handler | undefined;
  const previous = jest.fn();

  beforeAll(() => {
    (globalThis as unknown as { ErrorUtils: unknown }).ErrorUtils = {
      getGlobalHandler: () => previous,
      setGlobalHandler: (h: Handler) => {
        handler = h;
      },
    };
    installCrashGuard();
  });

  beforeEach(() => previous.mockClear());

  test("se engancha al manejador global", () => {
    expect(typeof handler).toBe("function");
  });

  test("un fatal avisa a quien escuche, para poder pintar el error", () => {
    const seen: string[] = [];
    const off = onFatal((c) => seen.push(c.message));
    handler?.(new Error("boom"), true);
    expect(seen).toEqual(["boom"]);
    off();
  });

  test("un fatal NO se delega: el manejador por defecto es el que deja la pantalla en blanco", () => {
    handler?.(new Error("boom"), true);
    expect(previous).not.toHaveBeenCalled();
  });

  test("los no fatales siguen su curso normal", () => {
    handler?.(new Error("aviso"), false);
    expect(previous).toHaveBeenCalledTimes(1);
  });

  test("aguanta que lo lanzado no sea un Error", () => {
    const seen: string[] = [];
    const off = onFatal((c) => seen.push(c.message));
    handler?.("texto suelto", true);
    expect(seen).toEqual(["texto suelto"]);
    off();
  });

  test("un oyente que revienta no impide manejar el error", () => {
    const off1 = onFatal(() => {
      throw new Error("oyente roto");
    });
    const seen: string[] = [];
    const off2 = onFatal((c) => seen.push(c.message));
    expect(() => handler?.(new Error("boom"), true)).not.toThrow();
    expect(seen).toEqual(["boom"]);
    off1();
    off2();
  });
});
