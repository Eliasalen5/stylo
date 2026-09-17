/**
 * Formatea un monto en pesos a string legible (ARS).
 * Ej: 3000 → "$3.000"
 */
export function formatPrice(price: number): string {
  return `$${price.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

/**
 * Formatea una fecha en la zona horaria indicada (vista corta en español).
 * Ej: "14 sep 2026"
 */
export function formatDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: timezone,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
