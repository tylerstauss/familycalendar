import { NextRequest, NextResponse } from "next/server";
import { sql, newId } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { reward_id, member_id } = await req.json();
  if (!reward_id || !member_id) {
    return NextResponse.json({ error: "reward_id and member_id required" }, { status: 400 });
  }

  // Fetch reward
  const [reward] = await sql`
    SELECT * FROM rewards WHERE id = ${reward_id} AND family_id = ${familyId}
  `;
  if (!reward) {
    return NextResponse.json({ error: "Reward not found" }, { status: 404 });
  }

  // Compute current balance
  const [earnedRow] = await sql`
    SELECT COALESCE(SUM(c.star_value), 0) AS earned
    FROM chore_completions cc
    JOIN chores c ON c.id = cc.chore_id
    WHERE cc.family_id = ${familyId} AND cc.member_id = ${member_id}
  `;
  const [spentRow] = await sql`
    SELECT COALESCE(SUM(stars_spent), 0) AS spent
    FROM reward_redemptions
    WHERE family_id = ${familyId} AND member_id = ${member_id}
  `;

  const earned = parseInt(earnedRow.earned as string, 10) || 0;
  const spent = parseInt(spentRow.spent as string, 10) || 0;
  const balance = earned - spent;
  const starCost = reward.star_cost as number;

  if (balance < starCost) {
    return NextResponse.json({ error: "Not enough stars" }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const id = newId();
  await sql`
    INSERT INTO reward_redemptions (id, family_id, reward_id, member_id, reward_name, stars_spent, date)
    VALUES (${id}, ${familyId}, ${reward_id}, ${member_id}, ${reward.name as string}, ${starCost}, ${today})
  `;

  return NextResponse.json({ ok: true, stars_spent: starCost }, { status: 201 });
}
