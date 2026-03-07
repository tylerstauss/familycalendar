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

import { sql } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

const SESSION = {
  userId: "u1",
  familyId: "f1",
  email: "test@example.com",
  name: "Test",
  role: "member",
};

function makeRequest() {
  return new NextRequest("http://localhost/api/subscribe/status");
}

describe("GET /api/subscribe/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      session: SESSION,
    });
  });

  it("returns 401 if not authenticated", async () => {
    (requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const { GET } = await import("@/app/api/subscribe/status/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns null if no subscription exists", async () => {
    (sql as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const { GET } = await import("@/app/api/subscribe/status/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeNull();
  });

  it("returns active subscription data", async () => {
    const sub = { id: "sub1", family_id: "f1", status: "active", plan: "monthly" };
    (sql as ReturnType<typeof vi.fn>).mockResolvedValue([sub]);
    const { GET } = await import("@/app/api/subscribe/status/route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("active");
    expect(body.plan).toBe("monthly");
  });

  it("returns trialing subscription with trial_ends_at", async () => {
    const trialEnd = new Date(Date.now() + 7 * 86400000).toISOString();
    const sub = { id: "sub1", family_id: "f1", status: "trialing", trial_ends_at: trialEnd };
    (sql as ReturnType<typeof vi.fn>).mockResolvedValue([sub]);
    const { GET } = await import("@/app/api/subscribe/status/route");
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.status).toBe("trialing");
    expect(body.trial_ends_at).toBe(trialEnd);
  });

  it("returns comped subscription", async () => {
    const sub = { id: "sub1", family_id: "f1", status: "comped", payment_method: "comped" };
    (sql as ReturnType<typeof vi.fn>).mockResolvedValue([sub]);
    const { GET } = await import("@/app/api/subscribe/status/route");
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.status).toBe("comped");
  });
});
