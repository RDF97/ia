# Ejemplo: cartel de evento (antes IA → después de verdad)

Caso real: la publicación del **España vs Bélgica en pantalla gigante** en la Plaza de la
Inmaculada de Tui, donde La de Manu pone la comida y la bebida.

## La idea

El primer intento fue un **cartel de plantilla** (banderas y pinceladas grunge genéricas):
info correcta, pero podría ser de cualquier bar de España y "olía a IA". El problema no era
el diseño, era **usar un gráfico en vez de algo real**.

La versión buena usa una **foto real del evento** (la plaza a reventar, la pantalla, la
gente con la camiseta de España) como protagonista, y encima solo la info justa, limpia y
alineada abajo. Eso no lo puede fingir ninguna IA.

## Archivos

- **`plaza-tui.jpg`** — la foto real (la protagonista).
- **`cartel-plaza.html`** — el generador: foto a pantalla completa + degradado + texto
  mínimo. Cambia el texto y sustituye la foto para reutilizarlo en otros eventos.
- **`cartel-plaza.png`** — el resultado, 1080×1350 (4:5), listo para el feed.

## El pie de foto que lo acompaña

> Así se llena la Plaza de la Inmaculada cuando juega España. 🔴🟡
>
> Pantalla gigante, cañas frías y medio Tui animando a una. Y el viernes… **repetimos**.
>
> España – Bélgica, viernes 10 a las 21:00. DJ desde las 19:00, y la comida y la bebida las
> ponemos nosotros. Tú trae la voz.
>
> Nos vemos en la plaza. 📍 Plaza de la Inmaculada, Tui.

## La regla que deja este ejemplo

Un cartel funciona **cuando debajo hay una foto de verdad**. Foto real primero; el texto,
solo el imprescindible y sin tapar el ambiente.
