import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/coinbase-commerce";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-cc-webhook-signature") ?? "";

  if (!verifyWebhookSignature(body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: { type: string; data: { object: { metadata?: { familyId?: string; plan?: string }; code?: string } } };
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (event.type === "charge:confirmed") {
    const charge = event.data.object;
    const familyId = charge.metadata?.familyId;
    const plan = charge.metadata?.plan;

    if (!familyId || !plan) {
      return NextResponse.json({ received: true });
    }

    const daysToAdd = plan === "annual" ? 365 : 30;
    const periodEnd = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toISOString();

    await sql`
      UPDATE subscriptions SET
        status = 'active',
        plan = ${plan},
        payment_method = 'coinbase',
        current_period_end = ${periodEnd},
        updated_at = NOW()::TEXT
      WHERE family_id = ${familyId}
    `;
  }

  return NextResponse.json({ received: true });
}
