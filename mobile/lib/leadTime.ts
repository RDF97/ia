/**
 * Antelación de un aviso, en minutos.
 *
 * Vivía dentro de `eventLogic.ts` porque solo la usaban los eventos. Al querer
 * lo mismo en las tareas se saca aquí: las dos pantallas tienen que ofrecer las
 * mismas opciones y con las mismas palabras, o el usuario ve dos vocabularios
 * distintos para la misma idea.
 */
export interface LeadOption {
  /** Minutos antes de la hora señalada. 0 = a la hora. */
  key: number;
  label: string;
  /** Etiqueta corta, para la ficha de una tarea en la lista. */
  short: string;
}

export const LEAD_OPTIONS: LeadOption[] = [
  { key: 0, label: "A la hora", short: "a la hora" },
  { key: 15, label: "15 min antes", short: "15 min antes" },
  { key: 60, label: "1 h antes", short: "1 h antes" },
  { key: 1440, label: "1 día antes", short: "1 día antes" },
];

/** Sin antelación: el aviso salta a la hora señalada. */
export const DEFAULT_LEAD = 0;

/** Normaliza un valor guardado: si no es una de las opciones, cae en "a la hora". */
export function normalizeLead(value: number | null | undefined): number {
  if (typeof value !== "number" || !isFinite(value)) return DEFAULT_LEAD;
  return LEAD_OPTIONS.some((o) => o.key === value) ? value : DEFAULT_LEAD;
}

export const leadLabel = (min: number): string =>
  LEAD_OPTIONS.find((o) => o.key === normalizeLead(min))?.short ?? "a la hora";
