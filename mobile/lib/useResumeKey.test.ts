import { REMOUNT_AFTER_SECONDS, shouldRemount } from "./useResumeKey";

describe("shouldRemount · cuándo recomponer al volver a la app", () => {
  test("vuelve de segundo plano tras un rato → se recompone", () => {
    expect(shouldRemount("background", "active", 30)).toBe(true);
  });

  test("un vistazo de un segundo a otra app no recompone", () => {
    expect(shouldRemount("background", "active", 1)).toBe(false);
  });

  test("justo en el umbral sí recompone", () => {
    expect(shouldRemount("background", "active", REMOUNT_AFTER_SECONDS)).toBe(true);
  });

  test("'inactive' no cuenta: es bajar el centro de control o una llamada", () => {
    expect(shouldRemount("inactive", "active", 60)).toBe(false);
  });

  test("irse al segundo plano no recompone (no hay nada que ver)", () => {
    expect(shouldRemount("active", "background", 60)).toBe(false);
  });
});
