const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12,
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "July 11, 2026 12:30 PM" → { date: "2026-07-11", time: "12:30" } (hora local). */
export function parseGygDate(input: string): { date: string; time?: string } | null {
  const m = input.match(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM)?)?/i);
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  if (!month) return null;
  const date = `${m[3]}-${pad(month)}-${pad(Number(m[2]))}`;
  if (!m[4]) return { date };
  let hour = Number(m[4]);
  const ampm = m[6]?.toUpperCase();
  if (ampm === "PM" && hour < 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  return { date, time: `${pad(hour)}:${m[5]}` };
}

/** "Sat 11.Jul '26 @ 09:30" → { date: "2026-07-11", time: "09:30" } (hora local). */
export function parseBokunDate(input: string): { date: string; time?: string } | null {
  const m = input.match(/(\d{1,2})\.([A-Za-z]{3,})\.?\s*'?(\d{2,4})(?:\s*@\s*(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const date = `${year}-${pad(month)}-${pad(Number(m[1]))}`;
  if (!m[4]) return { date };
  return { date, time: `${pad(Number(m[4]))}:${m[5]}` };
}
