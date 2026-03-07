import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { neon } from "@neondatabase/serverless";

const PUBLIC = ["/login", "/register"];
const SUBSCRIBE_EXEMPT = ["/login", "/register", "/subscribe"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Skip API routes and static files — they handle auth themselves
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }
  if (PUBLIC.includes(pathname)) return NextResponse.next();

  const token = req.cookies.get("session")?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (pathname.startsWith("/admin") && session.role !== "admin") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Subscription gate — admins always bypass
  if (!SUBSCRIBE_EXEMPT.some((p) => pathname.startsWith(p)) && session.role !== "admin") {
    try {
      const sql = neon(process.env.DATABASE_URL!);
      const [sub] = await sql`
        SELECT status, trial_ends_at, current_period_end
        FROM subscriptions WHERE family_id = ${session.familyId}
      `;
      const now = new Date();
      const hasAccess =
        sub?.status === "active" ||
        sub?.status === "comped" ||
        (sub?.status === "trialing" && sub.trial_ends_at && new Date(sub.trial_ends_at) > now);
      if (!hasAccess) {
        return NextResponse.redirect(new URL("/subscribe", req.url));
      }
    } catch (err) {
      console.error("Subscription check error:", err);
      // On error, allow access to avoid locking users out
    }
  }

  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
