/**
 * Geocodificación con Google Maps Geocoding API.
 * Solo se usa en servidor (el API key nunca llega al navegador).
 * Si no hay GEOCODING_API_KEY configurada, devuelve null sin fallar.
 */

export type Coordinates = {
  latitude: number;
  longitude: number;
};

/**
 * Construye la URL del endpoint de Google Maps Geocoding.
 * Pura y testeable: no hace fetch.
 */
export function buildGeocodingUrl(address: string, apiKey: string): URL {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", apiKey);
  return url;
}

export function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

export function isValidCoordinates(latitude: number, longitude: number): boolean {
  return isValidLatitude(latitude) && isValidLongitude(longitude);
}

/**
 * Geocodifica una dirección a coordenadas. Devuelve null si:
 *  - No hay GEOCODING_API_KEY configurada (degrade silencioso).
 *  - La API responde con error, o no encuentra resultados.
 * Nunca lanza: errores de red/integración se registran y devuelven null.
 */
export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  const apiKey = process.env.GEOCODING_API_KEY;
  if (!apiKey) {
    console.warn(
      "[geocoding] GEOCODING_API_KEY no configurada; se omite el geocoding."
    );
    return null;
  }

  const trimmed = address.trim();
  if (!trimmed) return null;

  let response: Response;
  try {
    response = await fetch(buildGeocodingUrl(trimmed, apiKey), {
      cache: "no-store",
    });
  } catch (error) {
    console.error("[geocoding] Error de red al geocodificar", error);
    return null;
  }

  if (!response.ok) {
    console.error(
      `[geocoding] Google Maps respondió ${response.status} ${response.statusText}`
    );
    return null;
  }

  let data: {
    status?: string;
    results?: { geometry?: { location?: { lat?: unknown; lng?: unknown } } }[];
  };
  try {
    data = (await response.json()) as typeof data;
  } catch (error) {
    console.error("[geocoding] Respuesta inválida de Google Maps", error);
    return null;
  }

  const location = data.results?.[0]?.geometry?.location;
  const latitude = location?.lat;
  const longitude = location?.lng;

  if (
    data.status !== "OK" ||
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !isValidCoordinates(latitude, longitude)
  ) {
    console.warn(
      `[geocoding] Sin coordenadas para la dirección (status: ${String(data.status)})`
    );
    return null;
  }

  return { latitude, longitude };
}