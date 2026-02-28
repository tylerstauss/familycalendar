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

// Returns the date of the Nth (or -Nth from end) occurrence of a weekday in a month
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

function expandRRule(
  rrule: RRule,
  dtstart: Date,
  duration: number,
  rangeStart: Date,
  rangeEnd: Date,
  exdateMs: Set<number>,
): Array<{ start: Date; end: Date }> {
  const results: Array<{ start: Date; end: Date }> = [];
  let occurrenceCount = 0;
  const MAX_RESULTS = 500;
  const MAX_ITER = 2000;
  let iter = 0;

  // Time-of-day in ms from UTC midnight (preserved on each occurrence)
  const dtMidnight = Date.UTC(dtstart.getUTCFullYear(), dtstart.getUTCMonth(), dtstart.getUTCDate());
  const timeOfDay = dtstart.getTime() - dtMidnight;

  // Returns true to continue, false to stop
  function consider(start: Date): boolean {
    if (rrule.until && start > rrule.until) return false;
    if (start < dtstart) return true; // fast-forward overshoot — skip, don't count
    if (exdateMs.has(start.getTime())) {
      occurrenceCount++;
      return rrule.count === undefined || occurrenceCount < rrule.count;
    }
    occurrenceCount++;
    if (rrule.count !== undefined && occurrenceCount > rrule.count) return false;
    const end = new Date(start.getTime() + duration);
    if (start < rangeEnd && end > rangeStart) {
      results.push({ start, end });
      if (results.length >= MAX_RESULTS) return false;
    }
    return true;
  }

  // ── DAILY ────────────────────────────────────────────────────────────────
  if (rrule.freq === "DAILY") {
    let cur = new Date(dtstart);
    if (!rrule.count && rangeStart > dtstart) {
      const skip = Math.max(0, Math.floor((rangeStart.getTime() - dtstart.getTime()) / (rrule.interval * MS_DAY)) - 1);
      cur = new Date(dtstart.getTime() + skip * rrule.interval * MS_DAY);
    }
    while (iter++ < MAX_ITER && cur < rangeEnd) {
      if (!consider(new Date(cur))) break;
      cur = new Date(cur.getTime() + rrule.interval * MS_DAY);
    }

  // ── WEEKLY ───────────────────────────────────────────────────────────────
  } else if (rrule.freq === "WEEKLY") {
    // Compute UTC midnight of the Sunday of dtstart's week
    const dtSunday = new Date(Date.UTC(dtstart.getUTCFullYear(), dtstart.getUTCMonth(), dtstart.getUTCDate()) - dtstart.getUTCDay() * MS_DAY);

    let weekStart = new Date(dtSunday);
    if (!rrule.count && rangeStart > dtstart) {
      const skip = Math.max(0, Math.floor((rangeStart.getTime() - dtSunday.getTime()) / (rrule.interval * 7 * MS_DAY)) - 1);
      weekStart = new Date(dtSunday.getTime() + skip * rrule.interval * 7 * MS_DAY);
    }

    // Days to generate: explicit BYDAY, or same weekday as dtstart
    const targetDays = rrule.byday.length > 0
      ? [...rrule.byday.map(b => b.day)].sort((a, b) => a - b)
      : [dtstart.getUTCDay()];

    while (iter++ < MAX_ITER && weekStart < rangeEnd) {
      let cont = true;
      for (const day of targetDays) {
        const occurrence = new Date(weekStart.getTime() + day * MS_DAY + timeOfDay);
        if (occurrence >= rangeEnd) { cont = false; break; }
        if (!consider(occurrence)) { cont = false; break; }
      }
      if (!cont) break;
      weekStart = new Date(weekStart.getTime() + rrule.interval * 7 * MS_DAY);
    }

  // ── MONTHLY ──────────────────────────────────────────────────────────────
  } else if (rrule.freq === "MONTHLY") {
    let curYear = dtstart.getUTCFullYear();
    let curMonth = dtstart.getUTCMonth();
    if (!rrule.count && rangeStart > dtstart) {
      const totalMonths = (rangeStart.getUTCFullYear() - curYear) * 12 + (rangeStart.getUTCMonth() - curMonth);
      const skip = Math.max(0, Math.floor(totalMonths / rrule.interval - 1) * rrule.interval);
      curMonth += skip;
      curYear += Math.floor(curMonth / 12);
      curMonth = ((curMonth % 12) + 12) % 12;
    }

    while (iter++ < MAX_ITER) {
      if (new Date(Date.UTC(curYear, curMonth, 1)) >= rangeEnd) break;

      const candidates: Date[] = [];

      if (rrule.byday.length > 0) {
        for (const { n, day } of rrule.byday) {
          if (n !== undefined) {
            // e.g. 2MO = second Monday, -1FR = last Friday
            const d = getNthWeekdayOfMonth(curYear, curMonth, day, n);
            if (d) candidates.push(new Date(d.getTime() + timeOfDay));
          } else {
            // All occurrences of that weekday in the month
            const first = new Date(Date.UTC(curYear, curMonth, 1));
            const diff = (day - first.getUTCDay() + 7) % 7;
            for (let dn = 1 + diff; dn <= daysInMonth(curYear, curMonth); dn += 7) {
              candidates.push(new Date(Date.UTC(curYear, curMonth, dn) + timeOfDay));
            }
          }
        }
      } else if (rrule.bymonthday.length > 0) {
        for (const dayNum of rrule.bymonthday) {
          const actual = dayNum > 0 ? dayNum : daysInMonth(curYear, curMonth) + dayNum + 1;
          if (actual >= 1 && actual <= daysInMonth(curYear, curMonth)) {
            candidates.push(new Date(Date.UTC(curYear, curMonth, actual) + timeOfDay));
          }
        }
      } else {
        // Same day of month as dtstart (capped to month length)
        const dn = Math.min(dtstart.getUTCDate(), daysInMonth(curYear, curMonth));
        candidates.push(new Date(Date.UTC(curYear, curMonth, dn) + timeOfDay));
      }

      candidates.sort((a, b) => a.getTime() - b.getTime());
      let cont = true;
      for (const c of candidates) {
        if (!consider(c)) { cont = false; break; }
      }
      if (!cont) break;

      curMonth += rrule.interval;
      curYear += Math.floor(curMonth / 12);
      curMonth = ((curMonth % 12) + 12) % 12;
    }

  // ── YEARLY ───────────────────────────────────────────────────────────────
  } else if (rrule.freq === "YEARLY") {
    let curYear = dtstart.getUTCFullYear();
    if (!rrule.count && rangeStart > dtstart) {
      const skip = Math.max(0, Math.floor((rangeStart.getUTCFullYear() - curYear) / rrule.interval - 1) * rrule.interval);
      curYear += skip;
    }

    while (iter++ < MAX_ITER) {
      if (curYear > rangeEnd.getUTCFullYear() + 1) break;

      let occurrence: Date;
      if (rrule.bymonth.length > 0 && rrule.byday.length > 0 && rrule.byday[0].n !== undefined) {
        // e.g. BYMONTH=3;BYDAY=2SU — second Sunday of March
        const d = getNthWeekdayOfMonth(curYear, rrule.bymonth[0] - 1, rrule.byday[0].day, rrule.byday[0].n!);
        if (!d) { curYear += rrule.interval; continue; }
        occurrence = new Date(d.getTime() + timeOfDay);
      } else if (rrule.bymonth.length > 0) {
        const month = rrule.bymonth[0] - 1;
        const dn = rrule.bymonthday.length > 0 ? rrule.bymonthday[0] : dtstart.getUTCDate();
        occurrence = new Date(Date.UTC(curYear, month, dn) + timeOfDay);
      } else {
        occurrence = new Date(Date.UTC(curYear, dtstart.getUTCMonth(), dtstart.getUTCDate()) + timeOfDay);
      }

      if (!consider(occurrence)) break;
      curYear += rrule.interval;
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
  let dtstart: Date | null = null, dtend: Date | null = null, recurrenceId: Date | undefined;
  let exdates: Date[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "BEGIN:VEVENT") {
      inEvent = true;
      uid = ""; summary = ""; location = ""; description = ""; rrule = undefined;
      dtstart = null; dtend = null; recurrenceId = undefined; exdates = [];
      continue;
    }

    if (trimmed === "END:VEVENT") {
      if (inEvent && dtstart) {
        events.push({
          uid, summary: summary || "Untitled", dtstart,
          dtend: dtend || new Date(dtstart.getTime() + 3_600_000),
          location, description, rrule, exdates, recurrenceId,
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
      case "DTSTART":      dtstart = parseIcalDate(value, tzid); break;
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
  // Group events by UID: one master (no RECURRENCE-ID) + N exceptions
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
      // Non-recurring event
      if (master.dtstart < rangeEnd && master.dtend > rangeStart) {
        results.push({ uid: master.uid, summary: master.summary, dtstart: master.dtstart, dtend: master.dtend, location: master.location, description: master.description });
      }
      continue;
    }

    const rrule = parseRRule(master.rrule);
    if (!rrule) {
      // Unparseable RRULE — fall back to first occurrence only
      if (master.dtstart < rangeEnd && master.dtend > rangeStart) {
        results.push({ uid: master.uid, summary: master.summary, dtstart: master.dtstart, dtend: master.dtend, location: master.location, description: master.description });
      }
      continue;
    }

    for (const { start, end } of expandRRule(rrule, master.dtstart, duration, rangeStart, rangeEnd, exdateMs)) {
      // If this occurrence was individually modified, use the exception's data
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

export async function getFamilyCalendarEvents(
  calendarId: string,
  color: string,
  icalUrl: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<CalendarEvent[]> {
  const text = await fetchIcalText(icalUrl);
  return expandEvents(parseIcalEvents(text), rangeStart, rangeEnd).map((evt) => ({
    id: `family-ical-${calendarId}-${evt.uid}-${evt.dtstart.getTime()}`,
    title: evt.summary,
    start_time: evt.dtstart.toISOString(),
    end_time: evt.dtend.toISOString(),
    location: evt.location,
    notes: evt.description,
    assignee_ids: [],
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
