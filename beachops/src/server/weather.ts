/**
 * Meteo con Open-Meteo (gratis, sin API key): viento y temperatura del
 * forecast normal + altura de ola de la API marina. Si la red falla o la
 * org no tiene coordenadas, se devuelve null y el cuadro simplemente no
 * muestra la franja de meteo.
 */

export type HourWeather = {
  hour: string; // "10:00"
  tempC: number | null;
  windKmh: number | null;
  gustKmh: number | null;
  precipProb: number | null;
  waveM: number | null;
};

type OpenMeteoHourly = {
  time: string[];
  temperature_2m?: (number | null)[];
  precipitation_probability?: (number | null)[];
  wind_speed_10m?: (number | null)[];
  wind_gusts_10m?: (number | null)[];
  wave_height?: (number | null)[];
};

async function fetchJson(url: string): Promise<{ hourly?: OpenMeteoHourly } | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 1800 }, // cachear media hora
    });
    if (!res.ok) return null;
    return (await res.json()) as { hourly?: OpenMeteoHourly };
  } catch {
    return null;
  }
}

export async function getDayWeather(
  lat: number,
  lng: number,
  date: string,
  hours: string[],
  timezone = "Europe/Madrid",
): Promise<HourWeather[] | null> {
  const tz = encodeURIComponent(timezone);
  const base = `latitude=${lat}&longitude=${lng}&start_date=${date}&end_date=${date}&timezone=${tz}`;
  const [weather, marine] = await Promise.all([
    fetchJson(
      `https://api.open-meteo.com/v1/forecast?${base}&hourly=temperature_2m,precipitation_probability,wind_speed_10m,wind_gusts_10m`,
    ),
    fetchJson(`https://marine-api.open-meteo.com/v1/marine?${base}&hourly=wave_height`),
  ]);
  if (!weather?.hourly) return null;

  const at = (h: OpenMeteoHourly | undefined, key: keyof OpenMeteoHourly, hour: string) => {
    if (!h) return null;
    const idx = h.time.findIndex((t) => t.endsWith(`T${hour}`));
    if (idx < 0) return null;
    const series = h[key] as (number | null)[] | undefined;
    return series?.[idx] ?? null;
  };

  return hours.map((hour) => ({
    hour,
    tempC: at(weather.hourly, "temperature_2m", hour),
    windKmh: at(weather.hourly, "wind_speed_10m", hour),
    gustKmh: at(weather.hourly, "wind_gusts_10m", hour),
    precipProb: at(weather.hourly, "precipitation_probability", hour),
    waveM: at(marine?.hourly ?? undefined, "wave_height", hour),
  }));
}

/** Coordenadas de la org guardadas en orgs.settings ({lat, lng}). */
export function orgCoords(settings: unknown): { lat: number; lng: number } | null {
  const s = settings as { lat?: number | string; lng?: number | string } | null;
  const lat = Number(s?.lat);
  const lng = Number(s?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  return { lat, lng };
}
