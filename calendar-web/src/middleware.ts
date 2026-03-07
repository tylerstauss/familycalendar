import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";
import { neon } from "@neondatabase/serverless";

const PUBLIC = ["/login", "/register", "/"];
const SUBSCRIBE_EXEMPT = ["/login", "/register", "/subscribe", "/"];

// Expired users can only access the calendar view
const CALENDAR_ONLY_PAGES = ["/calendar"];
const CALENDAR_ONLY_APIS = ["/api/events", "/api/members", "/api/family-calendars", "/api/ical"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip static files
  if (pathname.startsWith("/_next") || pathname.includes(".")) {
    return NextResponse.next();
  }

  // API routes — only do subscription check, no auth redirect
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  if (PUBLIC.includes(pathname)) {
    // Redirect logged-in users away from the landing page to the app
    if (pathname === "/") {
      const token = req.cookies.get("session")?.value;
      const session = token ? await verifySession(token) : null;
      if (session) return NextResponse.redirect(new URL("/calendar", req.url));
    }
    return NextResponse.next();
  }

  const token = req.cookies.get("session")?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (pathname.startsWith("/admin") && session.role !== "admin") {
    return NextResponse.redirect(new URL("/calendar", req.url));
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
      const hasFullAccess =
        sub?.status === "active" ||
        sub?.status === "comped" ||
        (sub?.status === "trialing" && sub.trial_ends_at && new Date(sub.trial_ends_at) > now);

      if (!hasFullAccess) {
        // Expired/cancelled users can still view the calendar
        const isCalendarOnly =
          CALENDAR_ONLY_PAGES.some((p) => pathname.startsWith(p)) ||
          CALENDAR_ONLY_APIS.some((p) => pathname.startsWith(p));
        if (!isCalendarOnly) {
          return NextResponse.redirect(new URL("/subscribe", req.url));
        }
      }
    } catch (err) {
      console.error("Subscription check error:", err);
      // On error, allow access to avoid locking users out
    }
  }

  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
