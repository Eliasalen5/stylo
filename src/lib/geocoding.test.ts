import { describe, it, expect } from "vitest";
import {
  buildGeocodingUrl,
  isValidCoordinates,
  isValidLatitude,
  isValidLongitude,
} from "@/lib/geocoding";

describe("buildGeocodingUrl", () => {
  it("arma la URL del endpoint de Google Maps", () => {
    const url = buildGeocodingUrl("Av. Corrientes 1234", "test-key");
    expect(url.origin + url.pathname).toBe(
      "https://maps.googleapis.com/maps/api/geocode/json"
    );
    expect(url.searchParams.get("address")).toBe("Av. Corrientes 1234");
    expect(url.searchParams.get("key")).toBe("test-key");
  });

  it("codifica la dirección correctamente", () => {
    const url = buildGeocodingUrl("Calle 12 & Av. Siempre Viva", "k");
    expect(url.searchParams.get("address")).toBe(
      "Calle 12 & Av. Siempre Viva"
    );
    expect(url.href).toContain("address=Calle+12+%26+Av.+Siempre+Viva");
  });
});

describe("isValidCoordinates", () => {
  it("acepta coordenadas válidas", () => {
    expect(isValidLatitude(-34.6037)).toBe(true);
    expect(isValidLongitude(-58.3816)).toBe(true);
    expect(isValidCoordinates(0, 0)).toBe(true);
    expect(isValidCoordinates(-90, -180)).toBe(true);
    expect(isValidCoordinates(90, 180)).toBe(true);
  });

  it("rechaza fuera de rango", () => {
    expect(isValidCoordinates(90.1, 0)).toBe(false);
    expect(isValidCoordinates(-90.1, 0)).toBe(false);
    expect(isValidCoordinates(0, 180.1)).toBe(false);
    expect(isValidCoordinates(0, -180.1)).toBe(false);
  });

  it("rechaza no numéricos e infinitos", () => {
    expect(isValidCoordinates(NaN, 0)).toBe(false);
    expect(isValidCoordinates(0, Infinity)).toBe(false);
    expect(isValidCoordinates(Infinity, -Infinity)).toBe(false);
  });
});