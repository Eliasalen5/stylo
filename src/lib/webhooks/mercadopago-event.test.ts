import { beforeEach, describe, it, expect, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
  subscription: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

const mockMercadoPago = vi.hoisted(() => ({
  getMercadoPagoPreapproval: vi.fn(),
  mapMercadoPagoStatus: vi.fn((mpStatus: string | null | undefined) => {
    switch (mpStatus) {
      case "AUTHORIZED":
        return "ACTIVE";
      case "PAUSED":
        return "PAST_DUE";
      case "CANCELLED":
        return "CANCELLED";
      default:
        return "PENDING";
    }
  }),
}));

vi.mock("@/lib/mercadopago", () => mockMercadoPago);

import { processMercadoPagoWebhookEvent } from "@/lib/webhooks/mercadopago-event";

type SubscriptionRow = {
  id: string;
  status: string;
  mpStatus: string | null;
  canceledAt: Date | null;
};

function makeSubscription(overrides?: Partial<SubscriptionRow>): SubscriptionRow {
  return {
    id: "sub_1",
    status: "PENDING",
    mpStatus: null,
    canceledAt: null,
    ...overrides,
  };
}

function makeTx() {
  return {
    subscriptionEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    subscription: {
      update: vi.fn(),
    },
  };
}

/**
 * Configura $transaction para ejecutar la callback y devuelve el tx mock
 * para poder asertar sobre las llamadas internas.
 */
function setTransaction(existingEvent: boolean) {
  const tx = makeTx();
  tx.subscriptionEvent.findUnique.mockResolvedValue(
    existingEvent ? { id: "existing" } : null
  );
  mockDb.$transaction.mockImplementation(
    async (fn: (transaction: typeof tx) => Promise<unknown>) => fn(tx)
  );
  return tx;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("processMercadoPagoWebhookEvent", () => {
  it("procesa y registra una suscripción autorizada", async () => {
    mockDb.subscription.findFirst.mockResolvedValue(makeSubscription());
    const tx = setTransaction(false);

    const result = await processMercadoPagoWebhookEvent({
      id: "evt_1",
      type: "subscription_preapproval.updated",
      data: {
        id: "mp_sub_1",
        status: "AUTHORIZED",
        next_charge_date: "2027-01-01T00:00:00.000-03:00",
      },
    });

    expect(result.outcome).toBe("processed");
    expect(result.subscriptionId).toBe("sub_1");
    expect(tx.subscriptionEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ mpEventId: "evt_1", eventType: "subscription_preapproval.updated" }),
    });
    expect(tx.subscription.update).toHaveBeenCalledWith({
      where: { id: "sub_1" },
      data: expect.objectContaining({ status: "ACTIVE", mpStatus: "AUTHORIZED" }),
    });
  });

  it("no duplica el procesamiento cuando el evento ya existe", async () => {
    mockDb.subscription.findFirst.mockResolvedValue(makeSubscription({ status: "ACTIVE" }));
    const tx = setTransaction(true);

    const result = await processMercadoPagoWebhookEvent({
      id: "evt_1",
      type: "subscription_preapproval.updated",
      data: { id: "mp_sub_1", status: "AUTHORIZED" },
    });

    expect(result.outcome).toBe("duplicate");
    expect(tx.subscription.update).not.toHaveBeenCalled();
    expect(tx.subscriptionEvent.create).not.toHaveBeenCalled();
  });

  it("ignora eventos de suscripciones desconocidas", async () => {
    mockDb.subscription.findFirst.mockResolvedValue(null);

    const result = await processMercadoPagoWebhookEvent({
      id: "evt_1",
      type: "subscription_preapproval.updated",
      data: { id: "otra" },
    });

    expect(result.outcome).toBe("ignored");
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("ignora payloads sin los campos esperados", async () => {
    const result = await processMercadoPagoWebhookEvent({ type: "nada" });
    expect(result.outcome).toBe("ignored");
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("marca cancelada y registra canceledAt", async () => {
    mockDb.subscription.findFirst.mockResolvedValue(makeSubscription());
    const tx = setTransaction(false);

    const result = await processMercadoPagoWebhookEvent({
      id: "evt_cancel",
      type: "subscription_preapproval.cancelled",
      data: { id: "mp_sub_1", status: "CANCELLED" },
    });

    expect(result.outcome).toBe("processed");
    expect(tx.subscription.update).toHaveBeenCalledWith({
      where: { id: "sub_1" },
      data: expect.objectContaining({
        status: "CANCELLED",
        canceledAt: expect.any(Date),
      }),
    });
  });

  it("no reactiva una suscripción ya cancelada", async () => {
    mockDb.subscription.findFirst.mockResolvedValue(
      makeSubscription({ status: "CANCELLED", canceledAt: new Date() })
    );
    const tx = setTransaction(false);

    await processMercadoPagoWebhookEvent({
      id: "evt_late",
      type: "subscription_preapproval.updated",
      data: { id: "mp_sub_1", status: "AUTHORIZED" },
    });

    expect(tx.subscription.update).toHaveBeenCalledWith({
      where: { id: "sub_1" },
      data: expect.objectContaining({
        status: "CANCELLED",
      }),
    });
    expect(tx.subscription.update).toHaveBeenCalledWith({
      where: { id: "sub_1" },
      data: expect.not.objectContaining({ canceledAt: expect.any(Date) }),
    });
  });

  it("consulta la API cuando el payload no trae estado (ej: cobro)", async () => {
    mockDb.subscription.findFirst.mockResolvedValue(makeSubscription());
    const tx = setTransaction(false);
    const fetchPreapproval = vi.fn().mockResolvedValue({
      status: "AUTHORIZED",
      next_charge_date: "2027-02-01T00:00:00.000-03:00",
    });

    const result = await processMercadoPagoWebhookEvent(
      { id: "evt_charge", type: "subscription_charged", data: { id: "mp_sub_1" } },
      { fetchPreapproval }
    );

    expect(fetchPreapproval).toHaveBeenCalledWith("mp_sub_1");
    expect(result.outcome).toBe("processed");
    expect(tx.subscription.update).toHaveBeenCalledWith({
      where: { id: "sub_1" },
      data: expect.objectContaining({ status: "ACTIVE", mpStatus: "AUTHORIZED" }),
    });
  });

  it("trata como duplicado un conflicto P2002 sobre mpEventId", async () => {
    mockDb.subscription.findFirst.mockResolvedValue(makeSubscription());
    mockDb.$transaction.mockRejectedValue({
      code: "P2002",
      meta: { target: ["mpEventId"] },
    });

    const result = await processMercadoPagoWebhookEvent({
      id: "evt_dup",
      type: "subscription_preapproval.updated",
      data: { id: "mp_sub_1", status: "AUTHORIZED" },
    });

    expect(result.outcome).toBe("duplicate");
    expect(result.subscriptionId).toBe("sub_1");
  });
});
