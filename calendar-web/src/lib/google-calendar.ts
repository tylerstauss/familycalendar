import { sql } from "./db";
import { CalendarEvent } from "./types";

function isAllDay(event: CalendarEvent): boolean {
  const s = new Date(event.start_time);
  const e = new Date(event.end_time);
  return (
    s.getUTCHours() === 0 && s.getUTCMinutes() === 0 && s.getUTCSeconds() === 0 &&
    e.getUTCHours() === 0 && e.getUTCMinutes() === 0 && e.getUTCSeconds() === 0 &&
    e.getTime() - s.getTime() >= 86400000
  );
}

function toGoogleEvent(event: CalendarEvent) {
  const allDay = isAllDay(event);
  return {
    summary: event.title,
    location: event.location || undefined,
    description: event.notes || undefined,
    start: allDay
      ? { date: event.start_time.slice(0, 10) }
      : { dateTime: event.start_time },
    end: allDay
      ? { date: event.end_time.slice(0, 10) }
      : { dateTime: event.end_time },
    recurrence: event.recurrence ? [`RRULE:${event.recurrence}`] : undefined,
  };
}

export async function getConnection(familyId: string) {
  const rows = await sql`SELECT * FROM google_connections WHERE family_id = ${familyId} LIMIT 1`;
  return rows[0] ?? null;
}

export async function getValidAccessToken(familyId: string): Promise<{ token: string; calendarId: string } | null> {
  const conn = await getConnection(familyId);
  if (!conn || conn.calendar_id === "pending") return null;

  // Still valid with 60s buffer?
  if (new Date(conn.token_expiry as string) > new Date(Date.now() + 60000)) {
    return { token: conn.access_token as string, calendarId: conn.calendar_id as string };
  }

  // Refresh the token
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: conn.refresh_token as string,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    console.error("Google token refresh failed:", await res.text());
    return null;
  }

  const data = await res.json();
  const newExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await sql`
    UPDATE google_connections
    SET access_token = ${data.access_token}, token_expiry = ${newExpiry}
    WHERE family_id = ${familyId}
  `;
  return { token: data.access_token as string, calendarId: conn.calendar_id as string };
}

export async function createGoogleEvent(familyId: string, event: CalendarEvent): Promise<string | null> {
  try {
    const auth = await getValidAccessToken(familyId);
    if (!auth) return null;
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calendarId)}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify(toGoogleEvent(event)),
      }
    );
    if (!res.ok) { console.error("Google create failed:", await res.text()); return null; }
    const data = await res.json();
    return (data.id as string) ?? null;
  } catch (err) {
    console.error("Google Calendar create error:", err);
    return null;
  }
}

export async function updateGoogleEvent(familyId: string, googleEventId: string, event: CalendarEvent): Promise<void> {
  try {
    const auth = await getValidAccessToken(familyId);
    if (!auth) return;
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calendarId)}/events/${encodeURIComponent(googleEventId)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify(toGoogleEvent(event)),
      }
    );
    if (!res.ok) console.error("Google update failed:", await res.text());
  } catch (err) {
    console.error("Google Calendar update error:", err);
  }
}

export async function deleteGoogleEvent(familyId: string, googleEventId: string): Promise<void> {
  try {
    const auth = await getValidAccessToken(familyId);
    if (!auth) return;
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calendarId)}/events/${encodeURIComponent(googleEventId)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${auth.token}` } }
    );
    // 404/410 = already deleted, that's fine
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      console.error("Google delete failed:", await res.text());
    }
  } catch (err) {
    console.error("Google Calendar delete error:", err);
  }
}

export async function listCalendars(accessToken: string): Promise<{ id: string; summary: string; primary?: boolean }[]> {
  const res = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return ((data.items ?? []) as { id: string; summary: string; primary?: boolean }[]).map((item) => ({
    id: item.id,
    summary: item.summary,
    primary: item.primary,
  }));
}
