import { describe, it, expect } from "vitest";
import { newId } from "@/lib/db";

describe("db — newId", () => {
  it("generates a non-empty string", () => {
    expect(typeof newId()).toBe("string");
    expect(newId().length).toBeGreaterThan(0);
  });

  it("generates unique IDs on each call", () => {
    const ids = new Set(Array.from({ length: 100 }, () => newId()));
    expect(ids.size).toBe(100);
  });

  it("contains only alphanumeric characters", () => {
    const id = newId();
    expect(id).toMatch(/^[a-z0-9]+$/);
  });
});
