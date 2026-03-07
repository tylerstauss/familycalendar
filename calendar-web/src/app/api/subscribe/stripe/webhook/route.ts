import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { sql } from "@/lib/db";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

function getPeriodEnd(sub: Stripe.Subscription): string | null {
  // current_period_end is on SubscriptionItem in the 2026-02-25.clover API
  const item = sub.items?.data?.[0];
  if (item?.current_period_end) {
    return new Date(item.current_period_end * 1000).toISOString();
  }
  return null;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const familyId = session.metadata?.familyId;
        const plan = session.metadata?.plan;
        if (!familyId || !plan) break;

        const subscriptionId = session.subscription as string;
        const stripeSub = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ["items"],
        });
        const periodEnd = getPeriodEnd(stripeSub);

        await sql`
          UPDATE subscriptions SET
            status = 'active',
            plan = ${plan},
            payment_method = 'stripe',
            stripe_subscription_id = ${subscriptionId},
            current_period_end = ${periodEnd},
            updated_at = NOW()::TEXT
          WHERE family_id = ${familyId}
        `;
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        // In the 2026 API, subscription is nested in parent.subscription_details
        const subscriptionId =
          (invoice.parent?.type === "subscription_details"
            ? (invoice.parent.subscription_details?.subscription as string)
            : null) ?? null;
        if (!subscriptionId) break;

        const stripeSub = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ["items"],
        });
        const periodEnd = getPeriodEnd(stripeSub);

        await sql`
          UPDATE subscriptions SET
            status = 'active',
            current_period_end = ${periodEnd},
            updated_at = NOW()::TEXT
          WHERE stripe_subscription_id = ${subscriptionId}
        `;
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await sql`
          UPDATE subscriptions SET
            status = 'cancelled',
            updated_at = NOW()::TEXT
          WHERE stripe_subscription_id = ${sub.id}
        `;
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const item = sub.items?.data?.[0];
        const periodEnd = item?.current_period_end
          ? new Date(item.current_period_end * 1000).toISOString()
          : null;
        const priceId = item?.price?.id;
        const monthlyId = process.env.STRIPE_MONTHLY_PRICE_ID;
        const annualId = process.env.STRIPE_ANNUAL_PRICE_ID;
        const plan = priceId === monthlyId ? "monthly" : priceId === annualId ? "annual" : null;

        if (plan) {
          await sql`
            UPDATE subscriptions SET
              plan = ${plan},
              current_period_end = ${periodEnd},
              updated_at = NOW()::TEXT
            WHERE stripe_subscription_id = ${sub.id}
          `;
        } else {
          await sql`
            UPDATE subscriptions SET
              current_period_end = ${periodEnd},
              updated_at = NOW()::TEXT
            WHERE stripe_subscription_id = ${sub.id}
          `;
        }
        break;
      }
    }
  } catch (err) {
    console.error("Stripe webhook handler error:", err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
