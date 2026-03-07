import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sql, newId } from "@/lib/db";
import { stripe } from "@/lib/stripe";

const PRICE_IDS: Record<string, string> = {
  monthly: process.env.STRIPE_MONTHLY_PRICE_ID!,
  annual: process.env.STRIPE_ANNUAL_PRICE_ID!,
};

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { plan } = await req.json();
  if (plan !== "monthly" && plan !== "annual") {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const priceId = PRICE_IDS[plan];
  if (!priceId) {
    return NextResponse.json({ error: "Price ID not configured" }, { status: 500 });
  }

  const [sub] = await sql`SELECT stripe_customer_id FROM subscriptions WHERE family_id = ${familyId}`;
  let customerId: string | undefined = sub?.stripe_customer_id ?? undefined;

  if (!customerId) {
    const [familyRow] = await sql`SELECT name FROM families WHERE id = ${familyId}`;
    const customer = await stripe.customers.create({
      name: familyRow?.name ?? "Family",
      metadata: { familyId },
    });
    customerId = customer.id;

    if (sub) {
      await sql`UPDATE subscriptions SET stripe_customer_id = ${customerId}, updated_at = NOW()::TEXT WHERE family_id = ${familyId}`;
    } else {
      const subId = newId();
      const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      await sql`
        INSERT INTO subscriptions (id, family_id, status, stripe_customer_id, trial_ends_at)
        VALUES (${subId}, ${familyId}, 'trialing', ${customerId}, ${trialEnd})
      `;
    }
  }

  const origin = req.headers.get("origin") ?? "https://localhost:3000";
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/subscribe`,
    metadata: { familyId, plan },
  });

  return NextResponse.json({ url: session.url });
}
