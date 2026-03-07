const COINBASE_API_URL = "https://api.commerce.coinbase.com";

const PRICES = {
  monthly: { amount: "4.99", name: "Family Calendar Monthly" },
  annual: { amount: "49.99", name: "Family Calendar Annual" },
};

export interface CoinbaseCharge {
  id: string;
  code: string;
  hosted_url: string;
}

export async function createCharge(
  plan: "monthly" | "annual",
  familyId: string,
  successUrl: string,
  cancelUrl: string
): Promise<CoinbaseCharge> {
  const price = PRICES[plan];
  const res = await fetch(`${COINBASE_API_URL}/charges`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CC-Api-Key": process.env.COINBASE_COMMERCE_API_KEY!,
      "X-CC-Version": "2018-03-22",
    },
    body: JSON.stringify({
      name: price.name,
      description: `${price.name} Subscription`,
      pricing_type: "fixed_price",
      local_price: { amount: price.amount, currency: "USD" },
      metadata: { familyId, plan },
      redirect_url: successUrl,
      cancel_url: cancelUrl,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Coinbase Commerce error: ${err}`);
  }

  const data = await res.json();
  return {
    id: data.data.id,
    code: data.data.code,
    hosted_url: data.data.hosted_url,
  };
}

export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const crypto = require("crypto");
  const secret = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET!;
  const computed = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return computed === signature;
}
