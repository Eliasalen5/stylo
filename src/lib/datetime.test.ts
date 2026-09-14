import { describe, it, expect } from "vitest";
import {
  localToUTC,
  toTimezoneComponents,
  addMinutes,
  compareTime,
  toMinutes,
} from "@/lib/datetime";

const BA = "America/Argentina/Buenos_Aires"; // UTC-3 sin DST
const MSK = "Europe/Moscow"; // UTC+3

describe("localToUTC", () => {
  it("convierte hora local a instante UTC (UTC-3, Buenos Aires)", () => {
    expect(localToUTC("2026-09-14", "10:00", BA).toISOString()).toBe(
      "2026-09-14T13:00:00.000Z"
    );
  });

  it("convierte medianoche local (UTC-3)", () => {
    expect(localToUTC("2026-09-14", "00:00", BA).toISOString()).toBe(
      "2026-09-14T03:00:00.000Z"
    );
  });

  it("maneja turnos que cruzan hacia el día siguiente en UTC", () => {
    // 23:30 local en BsAs = 02:30Z del día siguiente
    expect(localToUTC("2026-09-14", "23:30", BA).toISOString()).toBe(
      "2026-09-15T02:30:00.000Z"
    );
  });

  it("convierte hora local a instante UTC (UTC+3, Moscú)", () => {
    expect(localToUTC("2026-09-14", "10:00", MSK).toISOString()).toBe(
      "2026-09-14T07:00:00.000Z"
    );
  });

  it("retrocede al día anterior al convertir en timezone con offset positivo", () => {
    // 00:00 local en Moscú = 21:00Z del día anterior
    expect(localToUTC("2026-09-14", "00:00", MSK).toISOString()).toBe(
      "2026-09-13T21:00:00.000Z"
    );
  });

  it("redondea con segundos a cero", () => {
    expect(localToUTC("2026-09-14", "09:15", BA).toISOString()).toBe(
      "2026-09-14T12:15:00.000Z"
    );
  });
});

describe("toTimezoneComponents", () => {
  it("devuelve componentes en la timezone del negocio", () => {
    const c = toTimezoneComponents(new Date("2026-09-14T13:00:00.000Z"), BA);
    expect(c.dateStr).toBe("2026-09-14");
    expect(c.timeStr).toBe("10:00");
    expect(c.weekday).toBe("MONDAY");
  });

  it("devuelve el día siguiente local para horarios tardíos", () => {
    // 02:30Z = 23:30 local del 15 en BsAs (UTC-3)
    const c = toTimezoneComponents(new Date("2026-09-16T02:30:00.000Z"), BA);
    expect(c.dateStr).toBe("2026-09-15");
    expect(c.timeStr).toBe("23:30");
    expect(c.weekday).toBe("TUESDAY");
  });
});

describe("addMinutes / compareTime / toMinutes", () => {
  it("suma minutos y permite pasar de 24:00", () => {
    expect(addMinutes("23:30", 30)).toBe("24:00");
    expect(addMinutes("23:30", 60)).toBe("24:30");
  });

  it("compara horas HH:MM", () => {
    expect(compareTime("09:00", "10:00")).toBe(-1);
    expect(compareTime("10:00", "10:00")).toBe(0);
    expect(compareTime("11:00", "10:30")).toBe(1);
  });

  it("convierte HH:MM a minutos desde la medianoche", () => {
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("08:30")).toBe(510);
    expect(toMinutes("24:00")).toBe(1440);
  });
});