import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { sql, newId } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return NextResponse.redirect(new URL("/login", req.url));

  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/settings?google=error", req.url));
  }

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${origin}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    console.error("Token exchange failed:", await tokenRes.text());
    return NextResponse.redirect(new URL("/settings?google=error", req.url));
  }

  const { access_token, refresh_token, expires_in } = await tokenRes.json();
  const token_expiry = new Date(Date.now() + expires_in * 1000).toISOString();
  const { familyId } = auth.session;

  // Keep existing refresh token if Google didn't issue a new one
  const existing = await sql`SELECT refresh_token FROM google_connections WHERE family_id = ${familyId} LIMIT 1`;
  const finalRefreshToken = refresh_token || existing[0]?.refresh_token || "";

  // Upsert connection (calendar_id = "pending" until user picks one)
  await sql`DELETE FROM google_connections WHERE family_id = ${familyId}`;
  await sql`
    INSERT INTO google_connections (id, family_id, access_token, refresh_token, token_expiry, calendar_id, calendar_name)
    VALUES (${newId()}, ${familyId}, ${access_token}, ${finalRefreshToken}, ${token_expiry}, 'pending', 'pending')
  `;

  return NextResponse.redirect(new URL("/settings/google-calendar", req.url));
}
