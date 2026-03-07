import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock DB before importing the route
vi.mock("@/lib/db", () => ({
  sql: Object.assign(
    vi.fn(),
    { transaction: vi.fn() }
  ),
  newId: () => "test_id_123",
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    signSession: vi.fn().mockResolvedValue("mock_jwt_token"),
    setSessionCookie: vi.fn((res: Response) => res),
  };
});

import { sql } from "@/lib/db";

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no existing user
    (sql as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (sql as unknown as { transaction: ReturnType<typeof vi.fn> }).transaction.mockResolvedValue(undefined);
  });

  it("returns 400 if familyName is missing", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(makeRequest({ name: "Jane", email: "jane@example.com", password: "password123" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/family name/i);
  });

  it("returns 400 if name is missing", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(makeRequest({ familyName: "Smiths", email: "jane@example.com", password: "password123" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/name/i);
  });

  it("returns 400 if password is too short", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(makeRequest({ familyName: "Smiths", name: "Jane", email: "jane@example.com", password: "short" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/password/i);
  });

  it("returns 409 if email already exists", async () => {
    (sql as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ id: "existing_user" }]);
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(makeRequest({ familyName: "Smiths", name: "Jane", email: "exists@example.com", password: "password123" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/email/i);
  });

  it("returns 201 and user data on successful registration", async () => {
    (sql as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]); // no existing user
    const { POST } = await import("@/app/api/auth/register/route");
    const res = await POST(makeRequest({ familyName: "Smiths", name: "Jane", email: "new@example.com", password: "password123" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe("new@example.com");
    expect(body.user.name).toBe("Jane");
  });
});
