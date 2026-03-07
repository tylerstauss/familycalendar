import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/db", () => ({
  sql: vi.fn(),
  newId: () => "test_id_123",
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    requireAuth: vi.fn(),
  };
});

const mockCustomersCreate = vi.fn();
const mockCheckoutSessionCreate = vi.fn();

vi.mock("@/lib/stripe", () => ({
  stripe: {
    customers: { create: mockCustomersCreate },
    checkout: { sessions: { create: mockCheckoutSessionCreate } },
  },
}));

import { sql } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

const SESSION = {
  userId: "u1",
  familyId: "f1",
  email: "test@example.com",
  name: "Test",
  role: "member",
};

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/subscribe/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: "http://localhost" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/subscribe/stripe/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      session: SESSION,
    });
    mockCustomersCreate.mockResolvedValue({ id: "cus_test123" });
    mockCheckoutSessionCreate.mockResolvedValue({
      url: "https://checkout.stripe.com/test",
    });
  });

  it("returns 401 if not authenticated", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const { POST } = await import("@/app/api/subscribe/stripe/checkout/route");
    const res = await POST(makeRequest({ plan: "monthly" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid plan", async () => {
    const { POST } = await import("@/app/api/subscribe/stripe/checkout/route");
    const res = await POST(makeRequest({ plan: "weekly" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid plan/i);
  });

  it("creates checkout session and returns URL for existing customer", async () => {
    (sql as ReturnType<typeof vi.fn>).mockResolvedValue([
      { stripe_customer_id: "cus_existing" },
    ]);
    const { POST } = await import("@/app/api/subscribe/stripe/checkout/route");
    const res = await POST(makeRequest({ plan: "monthly" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://checkout.stripe.com/test");
    expect(mockCustomersCreate).not.toHaveBeenCalled();
    expect(mockCheckoutSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_existing",
        mode: "subscription",
      })
    );
  });

  it("creates a new Stripe customer when none exists", async () => {
    (sql as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([{ stripe_customer_id: null }]) // sub row
      .mockResolvedValueOnce([{ name: "Test Family" }]) // families lookup
      .mockResolvedValue([]); // update sql
    const { POST } = await import("@/app/api/subscribe/stripe/checkout/route");
    const res = await POST(makeRequest({ plan: "annual" }));
    expect(res.status).toBe(200);
    expect(mockCustomersCreate).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { familyId: "f1" } })
    );
  });

  it("includes trial_period_days: 7 in subscription_data", async () => {
    (sql as ReturnType<typeof vi.fn>).mockResolvedValue([
      { stripe_customer_id: "cus_existing" },
    ]);
    const { POST } = await import("@/app/api/subscribe/stripe/checkout/route");
    await POST(makeRequest({ plan: "monthly" }));
    expect(mockCheckoutSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_data: { trial_period_days: 7 },
      })
    );
  });

  it("uses correct price ID for annual plan", async () => {
    (sql as ReturnType<typeof vi.fn>).mockResolvedValue([
      { stripe_customer_id: "cus_existing" },
    ]);
    const { POST } = await import("@/app/api/subscribe/stripe/checkout/route");
    await POST(makeRequest({ plan: "annual" }));
    expect(mockCheckoutSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: process.env.STRIPE_ANNUAL_PRICE_ID, quantity: 1 }],
      })
    );
  });
});
