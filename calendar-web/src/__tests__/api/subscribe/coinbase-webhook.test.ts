import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  sql: vi.fn(),
  newId: () => "test_id_123",
}));

const mockVerifyWebhookSignature = vi.fn();

vi.mock("@/lib/coinbase-commerce", () => ({
  verifyWebhookSignature: mockVerifyWebhookSignature,
  createCharge: vi.fn(),
}));

import { sql } from "@/lib/db";

function makeRequest(body: string, signature = "valid_sig") {
  return new NextRequest("http://localhost/api/subscribe/coinbase/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cc-webhook-signature": signature,
    },
    body,
  });
}

describe("POST /api/subscribe/coinbase/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyWebhookSignature.mockReturnValue(true);
    (sql as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it("returns 400 for invalid signature", async () => {
    mockVerifyWebhookSignature.mockReturnValue(false);
    const { POST } = await import("@/app/api/subscribe/coinbase/webhook/route");
    const res = await POST(makeRequest("{}", "bad_sig"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid signature/i);
  });

  it("returns 200 and updates subscription on charge:confirmed (monthly)", async () => {
    const event = {
      type: "charge:confirmed",
      data: {
        object: {
          metadata: { familyId: "f1", plan: "monthly" },
          code: "CH123",
        },
      },
    };
    const { POST } = await import("@/app/api/subscribe/coinbase/webhook/route");
    const res = await POST(makeRequest(JSON.stringify(event)));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
    expect(sql).toHaveBeenCalled();
  });

  it("returns 200 and updates subscription on charge:confirmed (annual)", async () => {
    const event = {
      type: "charge:confirmed",
      data: {
        object: {
          metadata: { familyId: "f1", plan: "annual" },
          code: "CH456",
        },
      },
    };
    const { POST } = await import("@/app/api/subscribe/coinbase/webhook/route");
    const res = await POST(makeRequest(JSON.stringify(event)));
    expect(res.status).toBe(200);
    expect(sql).toHaveBeenCalled();
  });

  it("returns 200 but skips DB update for other event types", async () => {
    const event = {
      type: "charge:pending",
      data: { object: { metadata: { familyId: "f1", plan: "monthly" } } },
    };
    const { POST } = await import("@/app/api/subscribe/coinbase/webhook/route");
    const res = await POST(makeRequest(JSON.stringify(event)));
    expect(res.status).toBe(200);
    expect(sql).not.toHaveBeenCalled();
  });

  it("skips DB update on charge:confirmed with missing metadata", async () => {
    const event = {
      type: "charge:confirmed",
      data: { object: { metadata: {}, code: "CH789" } },
    };
    const { POST } = await import("@/app/api/subscribe/coinbase/webhook/route");
    const res = await POST(makeRequest(JSON.stringify(event)));
    expect(res.status).toBe(200);
    expect(sql).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON body", async () => {
    const { POST } = await import("@/app/api/subscribe/coinbase/webhook/route");
    const res = await POST(makeRequest("not-valid-json"));
    expect(res.status).toBe(400);
  });
});
