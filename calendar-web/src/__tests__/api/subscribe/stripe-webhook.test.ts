import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  sql: vi.fn(),
  newId: () => "test_id_123",
}));

const mockConstructEvent = vi.fn();
const mockSubscriptionsRetrieve = vi.fn();

vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: { constructEvent: mockConstructEvent },
    subscriptions: { retrieve: mockSubscriptionsRetrieve },
  },
}));

import { sql } from "@/lib/db";

const MOCK_SUB = {
  id: "sub_test",
  items: {
    data: [
      {
        current_period_end: Math.floor(Date.now() / 1000) + 86400,
        price: { id: process.env.STRIPE_MONTHLY_PRICE_ID },
      },
    ],
  },
};

function makeRequest(body: string, sig = "valid_sig") {
  return new NextRequest("http://localhost/api/subscribe/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": sig, "Content-Type": "text/plain" },
    body,
  });
}

describe("POST /api/subscribe/stripe/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscriptionsRetrieve.mockResolvedValue(MOCK_SUB);
    (sql as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it("returns 400 if stripe-signature header is missing", async () => {
    const req = new NextRequest("http://localhost/api/subscribe/stripe/webhook", {
      method: "POST",
      body: "{}",
    });
    const { POST } = await import("@/app/api/subscribe/stripe/webhook/route");
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/missing signature/i);
  });

  it("returns 400 if signature verification fails", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching");
    });
    const { POST } = await import("@/app/api/subscribe/stripe/webhook/route");
    const res = await POST(makeRequest("{}", "bad_sig"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid signature/i);
  });

  it("handles checkout.session.completed and updates subscription to active", async () => {
    const event = {
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { familyId: "f1", plan: "monthly" },
          subscription: "sub_test",
        },
      },
    };
    mockConstructEvent.mockReturnValue(event);
    const { POST } = await import("@/app/api/subscribe/stripe/webhook/route");
    const res = await POST(makeRequest(JSON.stringify(event)));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
    expect(sql).toHaveBeenCalled();
    expect(mockSubscriptionsRetrieve).toHaveBeenCalledWith("sub_test", {
      expand: ["items"],
    });
  });

  it("handles customer.subscription.deleted and sets status to cancelled", async () => {
    const event = {
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_test", items: { data: [] } } },
    };
    mockConstructEvent.mockReturnValue(event);
    const { POST } = await import("@/app/api/subscribe/stripe/webhook/route");
    const res = await POST(makeRequest(JSON.stringify(event)));
    expect(res.status).toBe(200);
    expect(sql).toHaveBeenCalled();
  });

  it("handles invoice.payment_succeeded and extends period end", async () => {
    const event = {
      type: "invoice.payment_succeeded",
      data: {
        object: {
          parent: {
            type: "subscription_details",
            subscription_details: { subscription: "sub_test" },
          },
        },
      },
    };
    mockConstructEvent.mockReturnValue(event);
    const { POST } = await import("@/app/api/subscribe/stripe/webhook/route");
    const res = await POST(makeRequest(JSON.stringify(event)));
    expect(res.status).toBe(200);
    expect(mockSubscriptionsRetrieve).toHaveBeenCalledWith("sub_test", {
      expand: ["items"],
    });
    expect(sql).toHaveBeenCalled();
  });

  it("handles customer.subscription.updated", async () => {
    const event = {
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_test",
          items: {
            data: [
              {
                current_period_end: Math.floor(Date.now() / 1000) + 86400,
                price: { id: process.env.STRIPE_ANNUAL_PRICE_ID },
              },
            ],
          },
        },
      },
    };
    mockConstructEvent.mockReturnValue(event);
    const { POST } = await import("@/app/api/subscribe/stripe/webhook/route");
    const res = await POST(makeRequest(JSON.stringify(event)));
    expect(res.status).toBe(200);
    expect(sql).toHaveBeenCalled();
  });

  it("returns 200 for unhandled event types without errors", async () => {
    const event = { type: "payment_intent.created", data: { object: {} } };
    mockConstructEvent.mockReturnValue(event);
    const { POST } = await import("@/app/api/subscribe/stripe/webhook/route");
    const res = await POST(makeRequest(JSON.stringify(event)));
    expect(res.status).toBe(200);
    expect(sql).not.toHaveBeenCalled();
  });

  it("skips checkout.session.completed if metadata is missing", async () => {
    const event = {
      type: "checkout.session.completed",
      data: { object: { metadata: {}, subscription: "sub_test" } },
    };
    mockConstructEvent.mockReturnValue(event);
    const { POST } = await import("@/app/api/subscribe/stripe/webhook/route");
    const res = await POST(makeRequest(JSON.stringify(event)));
    expect(res.status).toBe(200);
    expect(sql).not.toHaveBeenCalled();
  });
});
