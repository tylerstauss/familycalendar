import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { MemberStarBalance } from "@/lib/types";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const earnedRows = await sql`
    SELECT cc.member_id, SUM(c.star_value) AS earned
    FROM chore_completions cc
    JOIN chores c ON c.id = cc.chore_id
    WHERE cc.family_id = ${familyId}
    GROUP BY cc.member_id
  `;

  const spentRows = await sql`
    SELECT member_id, SUM(stars_spent) AS spent
    FROM reward_redemptions
    WHERE family_id = ${familyId}
    GROUP BY member_id
  `;

  const earnedMap = new Map<string, number>();
  for (const row of earnedRows) {
    earnedMap.set(row.member_id as string, parseInt(row.earned as string, 10) || 0);
  }

  const spentMap = new Map<string, number>();
  for (const row of spentRows) {
    spentMap.set(row.member_id as string, parseInt(row.spent as string, 10) || 0);
  }

  // Union of all member IDs that appear in either map
  const memberIds = new Set([...earnedMap.keys(), ...spentMap.keys()]);

  const balances: MemberStarBalance[] = Array.from(memberIds).map((member_id) => {
    const earned = earnedMap.get(member_id) ?? 0;
    const spent = spentMap.get(member_id) ?? 0;
    return { member_id, earned, spent, balance: earned - spent };
  });

  return NextResponse.json(balances);
}
