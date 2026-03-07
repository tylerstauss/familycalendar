import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sql } from "@/lib/db";
import { createCharge } from "@/lib/coinbase-commerce";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { plan } = await req.json();
  if (plan !== "monthly" && plan !== "annual") {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const origin = req.headers.get("origin") ?? "https://localhost:3000";
  const charge = await createCharge(
    plan,
    familyId,
    `${origin}/subscribe/crypto-pending`,
    `${origin}/subscribe`
  );

  await sql`
    UPDATE subscriptions SET
      coinbase_charge_code = ${charge.code},
      updated_at = NOW()::TEXT
    WHERE family_id = ${familyId}
  `;

  return NextResponse.json({ url: charge.hosted_url });
}
