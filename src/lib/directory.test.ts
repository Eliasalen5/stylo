import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = vi.hoisted(() => ({
  business: { findMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

import { listDirectoryBusinesses } from "@/lib/directory";

function makeBusiness(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Negocio ${id}`,
    slug: `negocio-${id}`,
    description: null,
    address: null,
    phone: null,
    logoUrl: null,
    timezone: "UTC",
    isFeatured: false,
    latitude: null,
    longitude: null,
    _count: { services: 1, professionals: 1 },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listDirectoryBusinesses", () => {
  it("solo devuelve negocios activos con servicios activos", async () => {
    mockDb.business.findMany.mockResolvedValue([makeBusiness("1")]);

    const result = await listDirectoryBusinesses();

    const { where } = mockDb.business.findMany.mock.calls[0][0];
    expect(where.isActive).toBe(true);
    expect(where.services).toEqual({ some: { isActive: true } });
    expect(result).toHaveLength(1);
    expect(result[0].servicesCount).toBe(1);
    expect(result[0].isFeatured).toBe(false);
  });

  it("ordena destacados primero", async () => {
    mockDb.business.findMany.mockResolvedValue([]);

    await listDirectoryBusinesses();

    const { orderBy } = mockDb.business.findMany.mock.calls[0][0];
    expect(orderBy).toEqual([{ isFeatured: "desc" }, { name: "asc" }]);
  });

  it("aplica el filtro de búsqueda por nombre o descripción", async () => {
    mockDb.business.findMany.mockResolvedValue([]);

    await listDirectoryBusinesses("barber");

    const { where } = mockDb.business.findMany.mock.calls[0][0];
    expect(where.OR).toEqual([
      { name: { contains: "barber", mode: "insensitive" } },
      { description: { contains: "barber", mode: "insensitive" } },
    ]);
  });

  it("no aplica filtro cuando el query es vacío", async () => {
    mockDb.business.findMany.mockResolvedValue([]);

    await listDirectoryBusinesses("   ");

    const { where } = mockDb.business.findMany.mock.calls[0][0];
    expect(where.OR).toBeUndefined();
  });
});