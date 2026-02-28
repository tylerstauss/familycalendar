import { CalendarEvent } from "./types";

// 5-minute in-memory cache per URL
const cache = new Map<string, { data: string; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

async function fetchIcalText(url: string): Promise<string> {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`iCal fetch failed: ${res.status}`);
  const text = await res.text();
  cache.set(url, { data: text, ts: Date.now() });
  return text;
}

// Unfold lines per RFC 5545 (continuation lines start with space/tab)
function unfold(text: string): string {
  return text.replace(/\r\n[ \t]/g, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

// Convert a naive local datetime (yr/mo/dy/hr/mn/sc) in a named IANA timezone to a UTC Date.
// Uses Intl.DateTimeFormat to determine the UTC offset for that timezone at that moment.
function localTzToUTC(yr: number, mo: number, dy: number, hr: number, mn: number, sc: number, tzid: string): Date {
  // Start with a UTC guess (treat the local time as if it were UTC)
  const utcGuess = new Date(Date.UTC(yr, mo, dy, hr, mn, sc));

  // Find out what "wall clock" time that UTC instant represents in the target timezone
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tzid,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(utcGuess);

  const get = (type: string) => +(parts.find((p) => p.type === type)?.value ?? "0");
  // hour12:false can return "24" for midnight
  const tzHr = get("hour") % 24;
  const displayedAsUTC = Date.UTC(get("year"), get("month") - 1, get("day"), tzHr, get("minute"), get("second"));

  // The offset is how far our guess drifted from the desired local time
  const offset = utcGuess.getTime() - displayedAsUTC;
  return new Date(utcGuess.getTime() + offset);
}

// Parse an iCal date/datetime string, respecting TZID when present
function parseIcalDate(value: string, tzid?: string): Date | null {
  if (!value) return null;

  // YYYYMMDD (all-day)
  if (/^\d{8}$/.test(value)) {
    const y = +value.slice(0, 4), m = +value.slice(4, 6) - 1, d = +value.slice(6, 8);
    return new Date(y, m, d);
  }

  // YYYYMMDDTHHmmss or YYYYMMDDTHHmmssZ
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!match) return null;

  const [, yr, mo, dy, hr, mn, sc, z] = match;

  if (z === "Z") {
    return new Date(Date.UTC(+yr, +mo - 1, +dy, +hr, +mn, +sc));
  }

  // Timezone-aware local time (TZID present) — convert properly
  if (tzid) {
    try {
      return localTzToUTC(+yr, +mo - 1, +dy, +hr, +mn, +sc, tzid);
    } catch {
      // Unknown TZID — fall through to UTC treatment
    }
  }

  // Floating time (no TZID, no Z) — treat as UTC (server runs in UTC)
  return new Date(Date.UTC(+yr, +mo - 1, +dy, +hr, +mn, +sc));
}

interface ParsedEvent {
  uid: string;
  summary: string;
  dtstart: Date;
  dtend: Date;
  location: string;
  description: string;
}

function parseIcalEvents(text: string): ParsedEvent[] {
  const unfolded = unfold(text);
  const lines = unfolded.split("\n");
  const events: ParsedEvent[] = [];

  let inEvent = false;
  let uid = "";
  let summary = "";
  let dtstart: Date | null = null;
  let dtend: Date | null = null;
  let location = "";
  let description = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "BEGIN:VEVENT") {
      inEvent = true;
      uid = "";
      summary = "";
      dtstart = null;
      dtend = null;
      location = "";
      description = "";
      continue;
    }

    if (trimmed === "END:VEVENT") {
      if (inEvent && dtstart) {
        events.push({
          uid,
          summary: summary || "Untitled",
          dtstart,
          dtend: dtend || new Date(dtstart.getTime() + 3600000), // default 1hr
          location,
          description,
        });
      }
      inEvent = false;
      continue;
    }

    if (!inEvent) continue;

    // Parse property:value or property;params:value
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx < 0) continue;

    const propPart = trimmed.slice(0, colonIdx);
    const value = trimmed.slice(colonIdx + 1);
    const propName = propPart.split(";")[0].toUpperCase();

    // Extract TZID param (e.g. DTSTART;TZID=America/New_York:...)
    const tzidMatch = propPart.match(/TZID=([^;:]+)/i);
    const tzid = tzidMatch?.[1];

    switch (propName) {
      case "UID":
        uid = value;
        break;
      case "SUMMARY":
        summary = unescapeIcal(value);
        break;
      case "DTSTART":
        dtstart = parseIcalDate(value, tzid);
        break;
      case "DTEND":
        dtend = parseIcalDate(value, tzid);
        break;
      case "LOCATION":
        location = unescapeIcal(value);
        break;
      case "DESCRIPTION":
        description = unescapeIcal(value);
        break;
    }
  }

  return events;
}

function unescapeIcal(s: string): string {
  return s.replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\\\/g, "\\").replace(/\\;/g, ";");
}

export async function getFamilyCalendarEvents(
  calendarId: string,
  color: string,
  icalUrl: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<CalendarEvent[]> {
  const text = await fetchIcalText(icalUrl);
  const vevents = parseIcalEvents(text);
  const results: CalendarEvent[] = [];

  for (const vevent of vevents) {
    if (vevent.dtstart < rangeEnd && vevent.dtend > rangeStart) {
      results.push({
        id: `family-ical-${calendarId}-${vevent.uid}`,
        title: vevent.summary,
        start_time: vevent.dtstart.toISOString(),
        end_time: vevent.dtend.toISOString(),
        location: vevent.location,
        notes: vevent.description,
        assignee_ids: [],
        source: "family-ical",
        color,
      });
    }
  }

  return results;
}

export async function getIcalEvents(
  memberId: string,
  icalUrl: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<CalendarEvent[]> {
  const text = await fetchIcalText(icalUrl);
  const vevents = parseIcalEvents(text);
  const results: CalendarEvent[] = [];

  for (const vevent of vevents) {
    // Check if event falls within range
    if (vevent.dtstart < rangeEnd && vevent.dtend > rangeStart) {
      results.push({
        id: `ical-${memberId}-${vevent.uid}`,
        title: vevent.summary,
        start_time: vevent.dtstart.toISOString(),
        end_time: vevent.dtend.toISOString(),
        location: vevent.location,
        notes: vevent.description,
        assignee_ids: [memberId],
        source: "ical",
      });
    }
  }

  return results;
}
