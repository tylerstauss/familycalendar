import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { verifyWebhookSignature } from "@/lib/coinbase-commerce";

function makeSignature(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

describe("coinbase-commerce — verifyWebhookSignature", () => {
  const secret = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET!;
  const payload = JSON.stringify({ type: "charge:confirmed", data: { object: { metadata: { familyId: "f1", plan: "monthly" } } } });

  it("returns true for a valid HMAC-SHA256 signature", () => {
    const sig = makeSignature(payload, secret);
    expect(verifyWebhookSignature(payload, sig)).toBe(true);
  });

  it("returns false for an incorrect signature", () => {
    expect(verifyWebhookSignature(payload, "deadbeef")).toBe(false);
  });

  it("returns false when signature is empty", () => {
    expect(verifyWebhookSignature(payload, "")).toBe(false);
  });

  it("returns false when payload is tampered", () => {
    const sig = makeSignature(payload, secret);
    const tampered = payload.replace("monthly", "annual");
    expect(verifyWebhookSignature(tampered, sig)).toBe(false);
  });
});
