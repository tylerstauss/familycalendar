import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Use vi.hoisted so these variables are available when vi.mock factories run
// (needed because `middleware` is imported at module level, triggering mock factories early)
const { mockVerifySession, mockSql } = vi.hoisted(() => ({
  mockVerifySession: vi.fn(),
  mockSql: vi.fn(),
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    verifySession: mockVerifySession,
  };
});

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn().mockReturnValue(mockSql),
}));

import { middleware } from "@/middleware";
import { neon } from "@neondatabase/serverless";

const SESSION = {
  userId: "u1",
  familyId: "f1",
  email: "test@example.com",
  name: "Test",
  role: "member",
};

const ADMIN_SESSION = { ...SESSION, role: "admin" };

function makeRequest(pathname: string, sessionCookie?: string) {
  const headers: Record<string, string> = {};
  if (sessionCookie) headers.cookie = `session=${sessionCookie}`;
  return new NextRequest(`http://localhost${pathname}`, { headers });
}

describe("middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-setup neon mock after clearAllMocks in case it reset the implementation
    (neon as ReturnType<typeof vi.fn>).mockReturnValue(mockSql);
  });

  // Static files
  it("passes through _next static files", async () => {
    const res = await middleware(makeRequest("/_next/static/chunk.js"));
    expect(res.status).toBe(200);
  });

  it("passes through files with extensions", async () => {
    const res = await middleware(makeRequest("/favicon.ico"));
    expect(res.status).toBe(200);
  });

  // API routes
  it("passes through API routes without auth check", async () => {
    const res = await middleware(makeRequest("/api/auth/login"));
    expect(res.status).toBe(200);
    expect(mockVerifySession).not.toHaveBeenCalled();
  });

  // Public routes (unauthenticated)
  it("allows unauthenticated access to /login", async () => {
    const res = await middleware(makeRequest("/login"));
    expect(res.status).toBe(200);
  });

  it("allows unauthenticated access to /register", async () => {
    const res = await middleware(makeRequest("/register"));
    expect(res.status).toBe(200);
  });

  it("allows unauthenticated access to / (landing page)", async () => {
    mockVerifySession.mockResolvedValue(null);
    const res = await middleware(makeRequest("/"));
    expect(res.status).toBe(200);
  });

  // Landing page redirect for logged-in users
  it("redirects authenticated users at / to /calendar", async () => {
    mockVerifySession.mockResolvedValue(SESSION);
    const res = await middleware(makeRequest("/", "valid_token"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/calendar");
  });

  // Auth gate
  it("redirects unauthenticated users to /login", async () => {
    mockVerifySession.mockResolvedValue(null);
    const res = await middleware(makeRequest("/calendar", "invalid_token"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("redirects users with no session cookie to /login", async () => {
    const res = await middleware(makeRequest("/calendar"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  // Admin gate
  it("redirects non-admin users away from /admin", async () => {
    mockVerifySession.mockResolvedValue(SESSION);
    mockSql.mockResolvedValue([{ status: "active" }]);
    const res = await middleware(makeRequest("/admin", "valid_token"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/calendar");
  });

  it("allows admin users to access /admin", async () => {
    mockVerifySession.mockResolvedValue(ADMIN_SESSION);
    const res = await middleware(makeRequest("/admin", "valid_token"));
    expect(res.status).toBe(200);
  });

  // Subscription gate — active
  it("allows users with active subscription to access /rides", async () => {
    mockVerifySession.mockResolvedValue(SESSION);
    mockSql.mockResolvedValue([{ status: "active", trial_ends_at: null }]);
    const res = await middleware(makeRequest("/rides", "valid_token"));
    expect(res.status).toBe(200);
  });

  it("allows users with comped subscription to access /rides", async () => {
    mockVerifySession.mockResolvedValue(SESSION);
    mockSql.mockResolvedValue([{ status: "comped", trial_ends_at: null }]);
    const res = await middleware(makeRequest("/rides", "valid_token"));
    expect(res.status).toBe(200);
  });

  // Subscription gate — trialing
  it("allows users in active trial to access /rides", async () => {
    mockVerifySession.mockResolvedValue(SESSION);
    mockSql.mockResolvedValue([{
      status: "trialing",
      trial_ends_at: new Date(Date.now() + 86400000 * 7).toISOString(),
    }]);
    const res = await middleware(makeRequest("/rides", "valid_token"));
    expect(res.status).toBe(200);
  });

  it("redirects users with expired trial to /subscribe", async () => {
    mockVerifySession.mockResolvedValue(SESSION);
    mockSql.mockResolvedValue([{
      status: "trialing",
      trial_ends_at: new Date(Date.now() - 1000).toISOString(),
    }]);
    const res = await middleware(makeRequest("/rides", "valid_token"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/subscribe");
  });

  // Subscription gate — expired
  it("redirects expired subscription to /subscribe for non-calendar pages", async () => {
    mockVerifySession.mockResolvedValue(SESSION);
    mockSql.mockResolvedValue([{ status: "expired", trial_ends_at: null }]);
    const res = await middleware(makeRequest("/rides", "valid_token"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/subscribe");
  });

  it("allows expired subscription to access /calendar (calendar-only access)", async () => {
    mockVerifySession.mockResolvedValue(SESSION);
    mockSql.mockResolvedValue([{ status: "expired", trial_ends_at: null }]);
    const res = await middleware(makeRequest("/calendar", "valid_token"));
    expect(res.status).toBe(200);
  });

  // Admin bypasses subscription gate
  it("admin bypasses subscription check entirely", async () => {
    mockVerifySession.mockResolvedValue(ADMIN_SESSION);
    const res = await middleware(makeRequest("/rides", "valid_token"));
    expect(res.status).toBe(200);
    expect(mockSql).not.toHaveBeenCalled();
  });

  // Subscribe-exempt pages
  it("allows expired users to access /subscribe", async () => {
    mockVerifySession.mockResolvedValue(SESSION);
    const res = await middleware(makeRequest("/subscribe", "valid_token"));
    expect(res.status).toBe(200);
  });
});
