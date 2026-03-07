import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const [sub] = await sql`SELECT stripe_customer_id FROM subscriptions WHERE family_id = ${familyId}`;
  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: "No Stripe subscription found" }, { status: 404 });
  }

  const origin = req.headers.get("origin") ?? "https://localhost:3000";
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${origin}/settings`,
  });

  return NextResponse.json({ url: session.url });
}
