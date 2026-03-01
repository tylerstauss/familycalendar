import { CalendarEvent } from "./types";

// 5-minute in-memory cache per URL
const cache = new Map<string, { data: string; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

async function fetchIcalText(url: string): Promise<string> {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;
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

// Convert a naive local datetime in a named IANA timezone to UTC
function localTzToUTC(yr: number, mo: number, dy: number, hr: number, mn: number, sc: number, tzid: string): Date {
  const utcGuess = new Date(Date.UTC(yr, mo, dy, hr, mn, sc));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tzid,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(utcGuess);
  const get = (type: string) => +(parts.find((p) => p.type === type)?.value ?? "0");
  const tzHr = get("hour") % 24;
  const displayedAsUTC = Date.UTC(get("year"), get("month") - 1, get("day"), tzHr, get("minute"), get("second"));
  return new Date(utcGuess.getTime() + (utcGuess.getTime() - displayedAsUTC));
}

// Parse an iCal date/datetime string, respecting TZID when present
function parseIcalDate(value: string, tzid?: string): Date | null {
  if (!value) return null;
  // YYYYMMDD (all-day)
  if (/^\d{8}$/.test(value)) {
    const y = +value.slice(0, 4), m = +value.slice(4, 6) - 1, d = +value.slice(6, 8);
    return new Date(Date.UTC(y, m, d));
  }
  // YYYYMMDDTHHmmss[Z]
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!match) return null;
  const [, yr, mo, dy, hr, mn, sc, z] = match;
  if (z === "Z") return new Date(Date.UTC(+yr, +mo - 1, +dy, +hr, +mn, +sc));
  if (tzid) {
    try { return localTzToUTC(+yr, +mo - 1, +dy, +hr, +mn, +sc, tzid); } catch { /* fall through */ }
  }
  return new Date(Date.UTC(+yr, +mo - 1, +dy, +hr, +mn, +sc));
}

// ── RRULE expansion ─────────────────────────────────────────────────────────

const MS_DAY = 86_400_000;
const DAY_NAMES: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

interface RRule {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  count?: number;
  until?: Date;
  byday: Array<{ n?: number; day: number }>;
  bymonthday: number[];
  bymonth: number[];
}

function parseRRule(str: string): RRule | null {
  const map: Record<string, string> = {};
  for (const part of str.split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0) map[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  const freq = map.FREQ as RRule["freq"];
  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq ?? "")) return null;
  const interval = Math.max(1, parseInt(map.INTERVAL || "1", 10) || 1);
  const rule: RRule = { freq, interval, byday: [], bymonthday: [], bymonth: [] };
  if (map.COUNT) rule.count = parseInt(map.COUNT, 10);
  if (map.UNTIL) { const u = parseIcalDate(map.UNTIL); if (u) rule.until = u; }
  if (map.BYDAY) {
    for (const d of map.BYDAY.split(",")) {
      const m = d.trim().match(/^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/i);
      if (m) rule.byday.push({ n: m[1] ? parseInt(m[1], 10) : undefined, day: DAY_NAMES[m[2].toUpperCase()] });
    }
  }
  if (map.BYMONTHDAY) rule.bymonthday = map.BYMONTHDAY.split(",").map(Number).filter(n => !isNaN(n));
  if (map.BYMONTH) rule.bymonth = map.BYMONTH.split(",").map(Number).filter(n => !isNaN(n));
  return rule;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date | null {
  if (n > 0) {
    const first = new Date(Date.UTC(year, month, 1));
    const day = 1 + ((weekday - first.getUTCDay() + 7) % 7) + (n - 1) * 7;
    return day <= daysInMonth(year, month) ? new Date(Date.UTC(year, month, day)) : null;
  } else {
    const last = new Date(Date.UTC(year, month, daysInMonth(year, month)));
    const day = daysInMonth(year, month) - ((last.getUTCDay() - weekday + 7) % 7) + (n + 1) * 7;
    return day >= 1 ? new Date(Date.UTC(year, month, day)) : null;
  }
}

// Local date/time components of a UTC Date in a given timezone.
// All date arithmetic is performed on "nominal UTC dates" where getUTC*()
// returns the LOCAL year/month/day/hour/etc., which lets us do correct
// day-of-week and calendar math in local time.
interface LocalComponents {
  y: number; mo: number; d: number;
  h: number; m: number; s: number;
  dow: number; // local day of week (0=Sun)
}

function getLocalComponents(dt: Date, tzid?: string): LocalComponents {
  if (tzid) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tzid,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }).formatToParts(dt);
    const get = (t: string) => +(parts.find(p => p.type === t)?.value ?? "0");
    const y = get("year"), mo = get("month") - 1, d = get("day");
    const h = get("hour") % 24, m = get("minute"), s = get("second");
    return { y, mo, d, h, m, s, dow: new Date(Date.UTC(y, mo, d)).getUTCDay() };
  }
  return {
    y: dt.getUTCFullYear(), mo: dt.getUTCMonth(), d: dt.getUTCDate(),
    h: dt.getUTCHours(), m: dt.getUTCMinutes(), s: dt.getUTCSeconds(),
    dow: dt.getUTCDay(),
  };
}

// Convert a LOCAL (y, mo, d) date + local time to a UTC Date, DST-aware
function localToUTC(y: number, mo: number, d: number, h: number, m: number, s: number, tzid?: string): Date {
  if (tzid) {
    try { return localTzToUTC(y, mo, d, h, m, s, tzid); } catch { /* fall through */ }
  }
  return new Date(Date.UTC(y, mo, d, h, m, s));
}

// Extract the "intended local date" from a range boundary Date.
// The API creates these as new Date(`${date}T00:00:00`) on the UTC server,
// so their UTC components (year/month/day) encode the LOCAL calendar date.
function rangeNominal(dt: Date): Date {
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
}

// Local date (as nominal UTC) of a UTC timestamp in the given timezone.
// Falls back to UTC-component date when no TZID is provided (e.g. all-day events).
function localDateNominal(dt: Date, tzid?: string): Date {
  if (tzid) {
    const lc = getLocalComponents(dt, tzid);
    return new Date(Date.UTC(lc.y, lc.mo, lc.d));
  }
  return rangeNominal(dt);
}

function expandRRule(
  rrule: RRule,
  dtstart: Date,
  duration: number,
  rangeStart: Date,
  rangeEnd: Date,
  exdateMs: Set<number>,
  ls: LocalComponents, // local components of dtstart
  tzid?: string,
): Array<{ start: Date; end: Date }> {
  const results: Array<{ start: Date; end: Date }> = [];
  let occurrenceCount = 0;
  const MAX_RESULTS = 500;
  const MAX_ITER = 2000;
  let iter = 0;

  // Local components of rangeStart — used for fast-forward arithmetic
  const lrs = getLocalComponents(rangeStart, tzid);
  // "Nominal UTC" = a Date whose getUTC*() gives LOCAL y/mo/d (for calendar arithmetic)
  const lrsNominal = new Date(Date.UTC(lrs.y, lrs.mo, lrs.d));

  // Returns true to continue iterating, false to stop
  function consider(utcStart: Date): boolean {
    if (rrule.until && utcStart > rrule.until) return false;
    if (utcStart < dtstart) return true; // fast-forward overshoot — skip, don't count
    if (exdateMs.has(utcStart.getTime())) {
      occurrenceCount++;
      return rrule.count === undefined || occurrenceCount < rrule.count;
    }
    occurrenceCount++;
    if (rrule.count !== undefined && occurrenceCount > rrule.count) return false;
    const utcEnd = new Date(utcStart.getTime() + duration);
    if (utcStart < rangeEnd && utcEnd > rangeStart) {
      results.push({ start: utcStart, end: utcEnd });
      if (results.length >= MAX_RESULTS) return false;
    }
    // Past the window with no COUNT — no more useful results
    if (utcStart >= rangeEnd && rrule.count === undefined) return false;
    return true;
  }

  // Nominal UTC of dtstart's local date (for arithmetic)
  const lsNominal = new Date(Date.UTC(ls.y, ls.mo, ls.d));

  // ── DAILY ────────────────────────────────────────────────────────────────
  if (rrule.freq === "DAILY") {
    let cur = new Date(lsNominal);
    if (!rrule.count && lrsNominal > cur) {
      const skip = Math.max(0, Math.floor((lrsNominal.getTime() - cur.getTime()) / (rrule.interval * MS_DAY)) - 1);
      cur = new Date(cur.getTime() + skip * rrule.interval * MS_DAY);
    }
    while (iter++ < MAX_ITER) {
      const utcStart = localToUTC(cur.getUTCFullYear(), cur.getUTCMonth(), cur.getUTCDate(), ls.h, ls.m, ls.s, tzid);
      if (!consider(utcStart)) break;
      cur = new Date(cur.getTime() + rrule.interval * MS_DAY);
    }

  // ── WEEKLY ───────────────────────────────────────────────────────────────
  } else if (rrule.freq === "WEEKLY") {
    // Nominal UTC Sunday of dtstart's LOCAL week
    let localSunday = new Date(lsNominal.getTime() - ls.dow * MS_DAY);

    if (!rrule.count && lrsNominal > lsNominal) {
      const skip = Math.max(0, Math.floor((lrsNominal.getTime() - localSunday.getTime()) / (rrule.interval * 7 * MS_DAY)) - 1);
      localSunday = new Date(localSunday.getTime() + skip * rrule.interval * 7 * MS_DAY);
    }

    // Days to generate: explicit BYDAY list, or same local weekday as dtstart
    const targetDays = rrule.byday.length > 0
      ? [...rrule.byday.map(b => b.day)].sort((a, b) => a - b)
      : [ls.dow];

    while (iter++ < MAX_ITER) {
      let cont = true;
      for (const day of targetDays) {
        // localDay is the LOCAL date (as nominal UTC) for this weekday in this week
        const localDay = new Date(localSunday.getTime() + day * MS_DAY);
        const utcStart = localToUTC(localDay.getUTCFullYear(), localDay.getUTCMonth(), localDay.getUTCDate(), ls.h, ls.m, ls.s, tzid);
        if (!consider(utcStart)) { cont = false; break; }
      }
      if (!cont) break;
      localSunday = new Date(localSunday.getTime() + rrule.interval * 7 * MS_DAY);
    }

  // ── MONTHLY ──────────────────────────────────────────────────────────────
  } else if (rrule.freq === "MONTHLY") {
    let curY = ls.y, curMo = ls.mo;
    if (!rrule.count && (lrs.y > curY || (lrs.y === curY && lrs.mo > curMo))) {
      const totalMonths = (lrs.y - curY) * 12 + (lrs.mo - curMo);
      const skip = Math.max(0, Math.floor(totalMonths / rrule.interval - 1) * rrule.interval);
      curMo += skip;
      curY += Math.floor(curMo / 12);
      curMo = ((curMo % 12) + 12) % 12;
    }

    while (iter++ < MAX_ITER) {
      // Candidates are nominal UTC dates for LOCAL dates in this month
      const candidates: Date[] = [];

      if (rrule.byday.length > 0) {
        for (const { n, day } of rrule.byday) {
          if (n !== undefined) {
            const d = getNthWeekdayOfMonth(curY, curMo, day, n);
            if (d) candidates.push(d);
          } else {
            const first = new Date(Date.UTC(curY, curMo, 1));
            const diff = (day - first.getUTCDay() + 7) % 7;
            for (let dn = 1 + diff; dn <= daysInMonth(curY, curMo); dn += 7) {
              candidates.push(new Date(Date.UTC(curY, curMo, dn)));
            }
          }
        }
      } else if (rrule.bymonthday.length > 0) {
        for (const dayNum of rrule.bymonthday) {
          const actual = dayNum > 0 ? dayNum : daysInMonth(curY, curMo) + dayNum + 1;
          if (actual >= 1 && actual <= daysInMonth(curY, curMo)) {
            candidates.push(new Date(Date.UTC(curY, curMo, actual)));
          }
        }
      } else {
        // Same local day-of-month as dtstart
        const dn = Math.min(ls.d, daysInMonth(curY, curMo));
        candidates.push(new Date(Date.UTC(curY, curMo, dn)));
      }

      candidates.sort((a, b) => a.getTime() - b.getTime());
      let cont = true;
      for (const localDay of candidates) {
        const utcStart = localToUTC(localDay.getUTCFullYear(), localDay.getUTCMonth(), localDay.getUTCDate(), ls.h, ls.m, ls.s, tzid);
        if (!consider(utcStart)) { cont = false; break; }
      }
      if (!cont) break;

      curMo += rrule.interval;
      curY += Math.floor(curMo / 12);
      curMo = ((curMo % 12) + 12) % 12;
    }

  // ── YEARLY ───────────────────────────────────────────────────────────────
  } else if (rrule.freq === "YEARLY") {
    let curY = ls.y;
    if (!rrule.count && lrs.y > curY) {
      const skip = Math.max(0, Math.floor((lrs.y - curY) / rrule.interval - 1) * rrule.interval);
      curY += skip;
    }

    while (iter++ < MAX_ITER) {
      let localDay: Date | null;
      if (rrule.bymonth.length > 0 && rrule.byday.length > 0 && rrule.byday[0].n !== undefined) {
        localDay = getNthWeekdayOfMonth(curY, rrule.bymonth[0] - 1, rrule.byday[0].day, rrule.byday[0].n!);
      } else if (rrule.bymonth.length > 0) {
        const dn = rrule.bymonthday.length > 0 ? rrule.bymonthday[0] : ls.d;
        localDay = new Date(Date.UTC(curY, rrule.bymonth[0] - 1, dn));
      } else {
        localDay = new Date(Date.UTC(curY, ls.mo, ls.d));
      }

      if (localDay) {
        const utcStart = localToUTC(localDay.getUTCFullYear(), localDay.getUTCMonth(), localDay.getUTCDate(), ls.h, ls.m, ls.s, tzid);
        if (!consider(utcStart)) break;
      }
      curY += rrule.interval;
    }
  }

  return results;
}

// ── iCal parser ─────────────────────────────────────────────────────────────

interface RawEvent {
  uid: string;
  summary: string;
  dtstart: Date;
  dtend: Date;
  dtStartTzid?: string; // TZID of DTSTART — needed for DST-aware recurrence expansion
  location: string;
  description: string;
  rrule?: string;
  exdates: Date[];
  recurrenceId?: Date;
}

function parseIcalEvents(text: string): RawEvent[] {
  const lines = unfold(text).split("\n");
  const events: RawEvent[] = [];

  let inEvent = false;
  let uid = "", summary = "", location = "", description = "", rrule: string | undefined;
  let dtstart: Date | null = null, dtend: Date | null = null;
  let dtStartTzid: string | undefined, recurrenceId: Date | undefined;
  let exdates: Date[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "BEGIN:VEVENT") {
      inEvent = true;
      uid = ""; summary = ""; location = ""; description = ""; rrule = undefined;
      dtstart = null; dtend = null; dtStartTzid = undefined; recurrenceId = undefined; exdates = [];
      continue;
    }

    if (trimmed === "END:VEVENT") {
      if (inEvent && dtstart) {
        events.push({
          uid, summary: summary || "Untitled", dtstart,
          dtend: dtend || new Date(dtstart.getTime() + 3_600_000),
          dtStartTzid, location, description, rrule, exdates, recurrenceId,
        });
      }
      inEvent = false;
      continue;
    }

    if (!inEvent) continue;

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx < 0) continue;

    const propPart = trimmed.slice(0, colonIdx);
    const value = trimmed.slice(colonIdx + 1);
    const propName = propPart.split(";")[0].toUpperCase();
    const tzid = propPart.match(/TZID=([^;:]+)/i)?.[1];

    switch (propName) {
      case "UID":          uid = value; break;
      case "SUMMARY":      summary = unescapeIcal(value); break;
      case "LOCATION":     location = unescapeIcal(value); break;
      case "DESCRIPTION":  description = unescapeIcal(value); break;
      case "RRULE":        rrule = value; break;
      case "DTSTART":
        dtstart = parseIcalDate(value, tzid);
        dtStartTzid = tzid;
        break;
      case "DTEND":        dtend = parseIcalDate(value, tzid); break;
      case "RECURRENCE-ID": recurrenceId = parseIcalDate(value, tzid) ?? undefined; break;
      case "EXDATE":
        for (const v of value.split(",")) {
          const d = parseIcalDate(v.trim(), tzid);
          if (d) exdates.push(d);
        }
        break;
    }
  }

  return events;
}

function unescapeIcal(s: string): string {
  return s.replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\\\/g, "\\").replace(/\\;/g, ";");
}

// ── Recurrence expansion ─────────────────────────────────────────────────────

interface ParsedEvent {
  uid: string; summary: string; dtstart: Date; dtend: Date; location: string; description: string;
}

function expandEvents(rawEvents: RawEvent[], rangeStart: Date, rangeEnd: Date): ParsedEvent[] {
  // Group by UID: one master (no RECURRENCE-ID) + modified exceptions
  const byUid = new Map<string, { master?: RawEvent; exceptions: Map<number, RawEvent> }>();
  for (const evt of rawEvents) {
    if (!byUid.has(evt.uid)) byUid.set(evt.uid, { exceptions: new Map() });
    const group = byUid.get(evt.uid)!;
    if (evt.recurrenceId) {
      group.exceptions.set(evt.recurrenceId.getTime(), evt);
    } else {
      group.master = evt;
    }
  }

  const results: ParsedEvent[] = [];

  for (const [, { master, exceptions }] of byUid) {
    if (!master) continue;
    const duration = master.dtend.getTime() - master.dtstart.getTime();
    const exdateMs = new Set(master.exdates.map(d => d.getTime()));

    if (!master.rrule) {
      if (master.dtstart < rangeEnd && master.dtend > rangeStart) {
        results.push({ uid: master.uid, summary: master.summary, dtstart: master.dtstart, dtend: master.dtend, location: master.location, description: master.description });
      }
      continue;
    }

    const rrule = parseRRule(master.rrule);
    if (!rrule) {
      if (master.dtstart < rangeEnd && master.dtend > rangeStart) {
        results.push({ uid: master.uid, summary: master.summary, dtstart: master.dtstart, dtend: master.dtend, location: master.location, description: master.description });
      }
      continue;
    }

    // Get local components of dtstart in the event's timezone for DST-aware expansion
    const localStart = getLocalComponents(master.dtstart, master.dtStartTzid);

    for (const { start, end } of expandRRule(rrule, master.dtstart, duration, rangeStart, rangeEnd, exdateMs, localStart, master.dtStartTzid)) {
      const ex = exceptions.get(start.getTime());
      if (ex) {
        results.push({ uid: master.uid, summary: ex.summary, dtstart: ex.dtstart, dtend: ex.dtend, location: ex.location, description: ex.description });
      } else {
        results.push({ uid: master.uid, summary: master.summary, dtstart: start, dtend: end, location: master.location, description: master.description });
      }
    }
  }

  return results;
}

// ── Public API ───────────────────────────────────────────────────────────────

// Match family member names found in an event title (case-insensitive, whole-word).
// Returns the IDs of all matching members, or [] if none match (meaning "all").
function assigneesFromTitle(title: string, members: Array<{ id: string; name: string }>): string[] {
  const matched: string[] = [];
  for (const member of members) {
    const escaped = member.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(title)) {
      matched.push(member.id);
    }
  }
  return matched; // empty = show for everyone
}

export async function getFamilyCalendarEvents(
  calendarId: string,
  color: string,
  icalUrl: string,
  rangeStart: Date,
  rangeEnd: Date,
  members: Array<{ id: string; name: string }> = [],
): Promise<CalendarEvent[]> {
  const text = await fetchIcalText(icalUrl);
  return expandEvents(parseIcalEvents(text), rangeStart, rangeEnd).map((evt) => ({
    id: `family-ical-${calendarId}-${evt.uid}-${evt.dtstart.getTime()}`,
    title: evt.summary,
    start_time: evt.dtstart.toISOString(),
    end_time: evt.dtend.toISOString(),
    location: evt.location,
    notes: evt.description,
    assignee_ids: assigneesFromTitle(evt.summary, members),
    source: "family-ical" as const,
    color,
  }));
}

export async function getIcalEvents(
  memberId: string,
  icalUrl: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<CalendarEvent[]> {
  const text = await fetchIcalText(icalUrl);
  return expandEvents(parseIcalEvents(text), rangeStart, rangeEnd).map((evt) => ({
    id: `ical-${memberId}-${evt.uid}-${evt.dtstart.getTime()}`,
    title: evt.summary,
    start_time: evt.dtstart.toISOString(),
    end_time: evt.dtend.toISOString(),
    location: evt.location,
    notes: evt.description,
    assignee_ids: [memberId],
    source: "ical" as const,
  }));
}
