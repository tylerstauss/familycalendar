import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";

vi.mock("@/lib/db", () => ({
  sql: vi.fn(),
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

const PASSWORD = "password123";
let hashedPassword: string;

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    hashedPassword = await bcrypt.hash(PASSWORD, 1); // cost=1 for test speed
  });

  it("returns 400 if email is missing", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeRequest({ password: PASSWORD }));
    expect(res.status).toBe(400);
  });

  it("returns 400 if password is missing", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeRequest({ email: "user@example.com" }));
    expect(res.status).toBe(400);
  });

  it("returns 401 if user does not exist", async () => {
    (sql as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeRequest({ email: "nobody@example.com", password: PASSWORD }));
    expect(res.status).toBe(401);
  });

  it("returns 401 if password is wrong", async () => {
    (sql as ReturnType<typeof vi.fn>).mockResolvedValue([{
      id: "u1", family_id: "f1", email: "user@example.com",
      name: "User", role: "member", password_hash: hashedPassword,
    }]);
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeRequest({ email: "user@example.com", password: "wrongpassword" }));
    expect(res.status).toBe(401);
  });

  it("returns 200 and user data on successful login", async () => {
    (sql as ReturnType<typeof vi.fn>).mockResolvedValue([{
      id: "u1", family_id: "f1", email: "user@example.com",
      name: "User", role: "member", password_hash: hashedPassword,
    }]);
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeRequest({ email: "USER@EXAMPLE.COM", password: PASSWORD }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe("user@example.com");
  });
});
