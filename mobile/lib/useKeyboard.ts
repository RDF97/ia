import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Alto del teclado cuando está abierto (0 si está cerrado).
 *
 * Sirve para subir lo que hay pegado abajo (hojas modales, barra de añadir) y
 * que no lo tape el teclado: sin esto escribes a ciegas porque el campo queda
 * debajo.
 *
 * En iOS usamos los eventos "Will" (van sincronizados con la animación) y en
 * Android los "Did", que son los únicos que dispara.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = Keyboard.addListener(showEvt, (e) => {
      setHeight(e.endCoordinates?.height ?? 0);
    });
    const onHide = Keyboard.addListener(hideEvt, () => setHeight(0));

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  return height;
}
