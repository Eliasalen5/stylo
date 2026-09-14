/**
 * Utilidades de fecha/hora para manejar timezones del negocio.
 * Usa Intl.DateTimeFormat nativo — sin dependencias externas.
 */

/**
 * Convierte un Date (UTC) a components en la timezone del negocio.
 */
export function toTimezoneComponents(
  date: Date,
  timezone: string
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: string; // "MONDAY", "TUESDAY", etc.
  timeStr: string; // "HH:MM"
  dateStr: string; // "YYYY-MM-DD"
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "long",
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  const year = parseInt(get("year"), 10);
  const month = parseInt(get("month"), 10);
  const day = parseInt(get("day"), 10);
  const hour = parseInt(get("hour"), 10);
  const minute = parseInt(get("minute"), 10);

  const weekdayEn = get("weekday").toUpperCase();
  const weekdayMap: Record<string, string> = {
    MONDAY: "MONDAY",
    TUESDAY: "TUESDAY",
    WEDNESDAY: "WEDNESDAY",
    THURSDAY: "THURSDAY",
    FRIDAY: "FRIDAY",
    SATURDAY: "SATURDAY",
    SUNDAY: "SUNDAY",
  };

  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  const yyyy = String(year).padStart(4, "0");
  const DD = String(day).padStart(2, "0");
  const MM = String(month).padStart(2, "0");

  return {
    year,
    month,
    day,
    hour,
    minute,
    weekday: weekdayMap[weekdayEn] ?? weekdayEn,
    timeStr: `${hh}:${mm}`,
    dateStr: `${yyyy}-${MM}-${DD}`,
  };
}

/**
 * Convierte una fecha local (dateStr "YYYY-MM-DD" + timeStr "HH:MM") en la timezone
 * del negocio a un objeto Date en UTC.
 *
 * Algoritmo: se interpreta el horario local como un instante "naive" (como si fuera
 * UTC) y se mide cuánto difiere su representación en la timezone destino del horario
 * deseado. Esa diferencia es el offset que hay que sumar al naive para obtener el
 * instante real en UTC.
 *
 * Ejemplo (America/Argentina/Buenos_Aires, UTC-3):
 *   localToUTC("2026-09-14", "10:00", ...) -> 13:00Z
 */
export function localToUTC(
  dateStr: string,
  timeStr: string,
  timezone: string
): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);

  // Interpretar el horario local como si fuera UTC (instante naive).
  const naiveDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));

  // Ver cómo se ve ese instante naive en la timezone del negocio.
  const tzParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(naiveDate);

  const get = (type: string) =>
    tzParts.find((p) => p.type === type)?.value ?? "0";

  let tzDay = parseInt(get("day"), 10);
  let tzHour = parseInt(get("hour"), 10);

  // Algunas implementaciones de Intl reportan la medianoche como hora "24".
  if (tzHour === 24) {
    tzHour = 0;
    tzDay += 1;
  }

  const tzMinute = parseInt(get("minute"), 10);

  // Diferencia entre el horario deseado y el que naive muestra en la timezone.
  let offsetMinutes = (hour - tzHour) * 60 + (minute - tzMinute);

  // Ajustar si la representación en la timezone cayó en el día anterior/siguiente.
  if (tzDay > day) offsetMinutes -= 24 * 60;
  if (tzDay < day) offsetMinutes += 24 * 60;

  // El instante real en UTC es naive + offset.
  const utcMs = naiveDate.getTime() + offsetMinutes * 60 * 1000;
  return new Date(utcMs);
}

/**
 * Convierte una hora "HH:MM" a minutos desde medianoche.
 * Permite horas >= 24 (ej: "24:00" -> 1440) para rangos que cruzan la medianoche.
 */
export function toMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Suma minutos a una hora en formato "HH:MM".
 * Devuelve "HH:MM" (puede pasar de 24:00, útil para range check).
 */
export function addMinutes(timeStr: string, minutes: number): string {
  const [h, m] = timeStr.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Compara dos horas "HH:MM". Devuelve -1, 0, o 1.
 */
export function compareTime(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Convierte un string ISO o timestamp a Date de forma segura.
 */
export function parseStartsAt(value: string): Date | null {
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}
