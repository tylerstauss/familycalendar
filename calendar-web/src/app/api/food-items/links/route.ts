import { NextRequest, NextResponse } from "next/server";
import { sql, newId } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { food_item_id, store_name, url, price } = await req.json();
  if (!food_item_id || !store_name?.trim() || !url?.trim()) {
    return NextResponse.json(
      { error: "food_item_id, store_name, and url are required" },
      { status: 400 }
    );
  }

  const id = newId();
  const priceVal = price != null ? Number(price) : null;

  await sql`
    INSERT INTO food_item_links (id, family_id, food_item_id, store_name, url, price)
    VALUES (${id}, ${familyId}, ${food_item_id}, ${store_name.trim()}, ${url.trim()}, ${priceVal})
  `;

  const [link] = await sql`SELECT * FROM food_item_links WHERE id = ${id}`;
  return NextResponse.json(link, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { id, store_name, url, price } = await req.json();
  if (!id || !store_name?.trim() || !url?.trim()) {
    return NextResponse.json(
      { error: "id, store_name, and url are required" },
      { status: 400 }
    );
  }

  const priceVal = price != null ? Number(price) : null;

  await sql`
    UPDATE food_item_links
    SET store_name = ${store_name.trim()}, url = ${url.trim()}, price = ${priceVal}
    WHERE id = ${id} AND family_id = ${familyId}
  `;

  const [link] = await sql`SELECT * FROM food_item_links WHERE id = ${id}`;
  return NextResponse.json(link);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.error;
  const { familyId } = auth.session;

  const { id } = await req.json();
  await sql`DELETE FROM food_item_links WHERE id = ${id} AND family_id = ${familyId}`;
  return NextResponse.json({ ok: true });
}
