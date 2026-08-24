/**
 * A qué tamaño mandar la foto del ticket para que se pueda leer.
 *
 * Lo que decide si un ticket se lee es el ANCHO: es lo que fija cuántos píxeles
 * de alto tiene cada letra. El alto solo suma peso.
 *
 * Antes se limitaba el lado largo a 2200 px para que las fotos pesaran parecido.
 * En un ticket normal daba igual, pero en uno de la compra semanal —una tira de
 * 3000 × 9000— el lado largo es el alto, así que la foto se encogía hasta
 * 733 px de ancho y el texto se quedaba en nada. Por eso los cortos se leían y
 * los largos no.
 */

/** Ancho al que se manda un ticket: suficiente para el texto, sin pasarse. */
export const MAX_ANCHO = 1400;

/**
 * Tope de alto, como red de seguridad. Un ticket kilométrico a 1400 de ancho
 * saldría de decenas de megapíxeles, y ahí sí pesa demasiado para mandarlo.
 */
export const MAX_ALTO = 4400;

export interface Fit {
  width: number;
  /** Ausente cuando no se sabe el tamaño original: entonces manda el ancho. */
  height?: number;
}

/**
 * Devuelve a qué tamaño reducir una foto de `w` × `h`, guardando la proporción.
 * Nunca agranda: una foto ya pequeña se manda tal cual.
 */
export function fitForOcr(w: number, h: number): Fit {
  // Si el selector no dice el tamaño, se manda solo el ancho y que la
  // proporción la ponga quien redimensiona. Devolver un alto de 0 aquí dejaba
  // la foto en nada.
  if (!(w > 0) || !(h > 0)) return { width: MAX_ANCHO };
  // El más restrictivo de los dos topes manda, y el 1 impide agrandar.
  const escala = Math.min(1, MAX_ANCHO / w, MAX_ALTO / h);
  return { width: Math.round(w * escala), height: Math.round(h * escala) };
}
