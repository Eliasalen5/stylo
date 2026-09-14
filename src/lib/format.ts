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
