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
    requireAdmin: vi.fn(),
  };
});

import { sql } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

const ADMIN_SESSION = {
  userId: "admin1",
  familyId: "f_admin",
  email: "admin@example.com",
  name: "Admin",
  role: "admin",
};

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/admin/families/f1/comp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/families/[id]/comp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      session: ADMIN_SESSION,
    });
  });

  it("returns 401 if not authenticated", async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const { POST } = await import("@/app/api/admin/families/[id]/comp/route");
    const res = await POST(makeRequest({ comped: true }), {
      params: Promise.resolve({ id: "f1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 if not admin", async () => {
    (requireAdmin as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const { POST } = await import("@/app/api/admin/families/[id]/comp/route");
    const res = await POST(makeRequest({ comped: true }), {
      params: Promise.resolve({ id: "f1" }),
    });
    expect(res.status).toBe(403);
  });

  it("updates an existing subscription to comped", async () => {
    const compedSub = {
      id: "sub1",
      family_id: "f1",
      status: "comped",
      payment_method: "comped",
    };
    (sql as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([{ id: "sub1" }]) // SELECT existing
      .mockResolvedValueOnce([]) // UPDATE
      .mockResolvedValueOnce([compedSub]); // SELECT final
    const { POST } = await import("@/app/api/admin/families/[id]/comp/route");
    const res = await POST(makeRequest({ comped: true }), {
      params: Promise.resolve({ id: "f1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("comped");
    expect(body.payment_method).toBe("comped");
  });

  it("creates a new comped subscription if none exists", async () => {
    const compedSub = { id: "test_id_123", family_id: "f1", status: "comped" };
    (sql as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([]) // SELECT existing → none
      .mockResolvedValueOnce([]) // INSERT
      .mockResolvedValueOnce([compedSub]); // SELECT final
    const { POST } = await import("@/app/api/admin/families/[id]/comp/route");
    const res = await POST(makeRequest({ comped: true }), {
      params: Promise.resolve({ id: "f1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("comped");
  });

  it("removes comp and sets status to expired", async () => {
    const expiredSub = { id: "sub1", family_id: "f1", status: "expired" };
    (sql as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([]) // UPDATE
      .mockResolvedValueOnce([expiredSub]); // SELECT final
    const { POST } = await import("@/app/api/admin/families/[id]/comp/route");
    const res = await POST(makeRequest({ comped: false }), {
      params: Promise.resolve({ id: "f1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("expired");
  });

  it("sets comped_by to the admin's userId", async () => {
    const compedSub = {
      id: "sub1",
      family_id: "f1",
      status: "comped",
      comped_by: ADMIN_SESSION.userId,
    };
    (sql as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([{ id: "sub1" }]) // SELECT existing
      .mockResolvedValueOnce([]) // UPDATE
      .mockResolvedValueOnce([compedSub]); // SELECT final
    const { POST } = await import("@/app/api/admin/families/[id]/comp/route");
    const res = await POST(makeRequest({ comped: true }), {
      params: Promise.resolve({ id: "f1" }),
    });
    const body = await res.json();
    expect(body.comped_by).toBe(ADMIN_SESSION.userId);
  });
});
