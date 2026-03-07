import { describe, it, expect } from "vitest";
import { signSession, verifySession } from "@/lib/auth";
import type { SessionPayload } from "@/lib/auth";

const payload: SessionPayload = {
  userId: "user_1",
  familyId: "family_1",
  email: "test@example.com",
  name: "Test User",
  role: "member",
};

describe("auth — signSession / verifySession", () => {
  it("signs a token and verifies it back to the original payload", async () => {
    const token = await signSession(payload);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3); // JWT has 3 parts

    const result = await verifySession(token);
    expect(result?.userId).toBe(payload.userId);
    expect(result?.familyId).toBe(payload.familyId);
    expect(result?.email).toBe(payload.email);
    expect(result?.name).toBe(payload.name);
    expect(result?.role).toBe(payload.role);
  });

  it("returns null for an invalid token", async () => {
    const result = await verifySession("not.a.valid.token");
    expect(result).toBeNull();
  });

  it("returns null for an empty string", async () => {
    const result = await verifySession("");
    expect(result).toBeNull();
  });

  it("returns null for a tampered token", async () => {
    const token = await signSession(payload);
    const parts = token.split(".");
    parts[1] = Buffer.from(JSON.stringify({ userId: "hacker" })).toString("base64url");
    const tampered = parts.join(".");
    const result = await verifySession(tampered);
    expect(result).toBeNull();
  });

  it("signs tokens for admin role correctly", async () => {
    const adminToken = await signSession({ ...payload, role: "admin" });
    const result = await verifySession(adminToken);
    expect(result?.role).toBe("admin");
  });
});
