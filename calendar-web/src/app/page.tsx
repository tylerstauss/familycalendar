"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { format, addDays, subDays, addMonths, subMonths, isToday, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay, isSameMonth } from "date-fns";
import { CalendarEvent, FamilyMember, MealPlan, getMemberColumnBg, getMemberTextColor } from "@/lib/types";
import EventCard from "@/components/EventCard";
import AddEventModal from "@/components/AddEventModal";

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("day");
  const [now, setNow] = useState(new Date());

  // Update clock every minute
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch members once
  useEffect(() => {
    fetch("/api/members").then((r) => r.json()).then(setMembers);
  }, []);

  // Fetch events when date or view changes
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");

    let params: string;
    if (viewMode === "day") {
      params = `start=${dateStr}&end=${dateStr}`;
    } else if (viewMode === "week") {
      const ws = startOfWeek(selectedDate, { weekStartsOn: 0 });
      const we = endOfWeek(selectedDate, { weekStartsOn: 0 });
      params = `start=${format(ws, "yyyy-MM-dd")}&end=${format(we, "yyyy-MM-dd")}`;
    } else {
      // Month view — fetch the full grid (may include days from prev/next month)
      const ms = startOfWeek(startOfMonth(selectedDate), { weekStartsOn: 0 });
      const me = endOfWeek(endOfMonth(selectedDate), { weekStartsOn: 0 });
      params = `start=${format(ms, "yyyy-MM-dd")}&end=${format(me, "yyyy-MM-dd")}`;
    }

    // Fetch local, iCal events, and meal plans in parallel
    const [localRes, icalRes, mealsRes] = await Promise.allSettled([
      fetch(`/api/events?${params}`).then((r) => r.json()),
      fetch(`/api/ical?${params}`).then((r) => r.json()),
      fetch(`/api/meal-plans?${params}`).then((r) => r.json()),
    ]);

    const localEvents: CalendarEvent[] = localRes.status === "fulfilled" ? localRes.value : [];
    const icalEvents: CalendarEvent[] = icalRes.status === "fulfilled" && Array.isArray(icalRes.value) ? icalRes.value : [];

    // Convert meal plans to calendar events
    const mealTimeMap: Record<string, { hour: number; minute: number; label: string }> = {
      breakfast: { hour: 8, minute: 0, label: "Breakfast" },
      lunch: { hour: 12, minute: 30, label: "Lunch" },
      dinner: { hour: 18, minute: 15, label: "Dinner" },
      snack: { hour: 15, minute: 0, label: "Snack" },
    };
    const mealPlans: MealPlan[] = mealsRes.status === "fulfilled" && Array.isArray(mealsRes.value) ? mealsRes.value : [];
    const mealEvents: CalendarEvent[] = mealPlans.map((mp) => {
      const time = mealTimeMap[mp.meal_type] || mealTimeMap.dinner;
      const startDate = new Date(`${mp.date}T00:00:00`);
      startDate.setHours(time.hour, time.minute, 0);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour duration
      return {
        id: `meal-${mp.id}`,
        title: `${time.label}: ${mp.food_name}`,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        location: "",
        notes: mp.notes || "",
        assignee_ids: mp.assignee_ids || [],
        source: "meal" as const,
      };
    });

    // Merge and sort
    const merged = [...localEvents, ...icalEvents, ...mealEvents].sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
    setEvents(merged);
    setLoading(false);
  }, [selectedDate, viewMode]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const navigateDate = (dir: number) => {
    setSelectedDate((d) => {
      if (viewMode === "month") return dir > 0 ? addMonths(d, 1) : subMonths(d, 1);
      if (viewMode === "week") return dir > 0 ? addDays(d, 7) : subDays(d, 7);
      return dir > 0 ? addDays(d, 1) : subDays(d, 1);
    });
  };

  const handleAddEvent = async (event: Omit<CalendarEvent, "id" | "created_at">) => {
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    fetchEvents();
  };

  const handleUpdateEvent = async (event: CalendarEvent) => {
    await fetch("/api/events", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    setEditingEvent(null);
    fetchEvents();
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm("Delete this event?")) return;
    await fetch("/api/events", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchEvents();
  };

  // Group events by day for week view
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(weekStart, i);
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    return {
      date: day,
      events: events.filter((e) => {
        const s = new Date(e.start_time);
        const en = new Date(e.end_time);
        return s < dayEnd && en > dayStart;
      }),
    };
  });

  return (
    <div className="min-h-screen">
      {/* Skylight Header */}
      <header className="px-4 md:px-8 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          {/* Left: date + time */}
          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {viewMode === "month"
                ? format(selectedDate, "MMMM yyyy")
                : format(selectedDate, "EEE, MMM d")}
            </h1>
            {viewMode !== "month" && isToday(selectedDate) && (
              <span className="text-lg text-gray-400 font-medium">
                {format(now, "h:mm a")}
              </span>
            )}
          </div>

          {/* Right: controls */}
          <div className="flex items-center gap-2">
            {/* Day/Week/Month toggle */}
            <div className="bg-gray-100 rounded-xl p-0.5 flex">
              <button
                onClick={() => setViewMode("day")}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${viewMode === "day" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
              >
                Day
              </button>
              <button
                onClick={() => setViewMode("week")}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${viewMode === "week" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
              >
                Week
              </button>
              <button
                onClick={() => setViewMode("month")}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${viewMode === "month" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
              >
                Month
              </button>
            </div>

            {/* Today button */}
            {!isToday(selectedDate) && (
              <button
                onClick={() => setSelectedDate(new Date())}
                className="px-3 py-1.5 text-sm font-medium text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                Today
              </button>
            )}

            {/* Navigation arrows */}
            <button onClick={() => navigateDate(-1)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={() => navigateDate(1)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>

        {/* Week range subtitle */}
        {viewMode === "week" && (
          <p className="text-sm text-gray-400 mt-1">
            {format(weekStart, "MMM d")} &ndash; {format(weekEnd, "MMM d, yyyy")}
          </p>
        )}
        {/* Month subtitle — how many events this month */}
        {viewMode === "month" && events.length > 0 && (
          <p className="text-sm text-gray-400 mt-1">
            {events.length} event{events.length !== 1 ? "s" : ""}
          </p>
        )}
      </header>

      {/* Content */}
      <div className="px-4 md:px-8 py-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : viewMode === "day" ? (
          <DayView
            events={events}
            members={members}
            onEdit={setEditingEvent}
            onDelete={handleDeleteEvent}
            now={now}
            selectedDate={selectedDate}
          />
        ) : viewMode === "week" ? (
          <WeekView
            weekDays={weekDays}
            events={events}
            members={members}
            onDayClick={(date) => { setSelectedDate(date); setViewMode("day"); }}
            now={now}
          />
        ) : (
          <MonthView
            selectedDate={selectedDate}
            events={events}
            members={members}
            onDayClick={(date) => { setSelectedDate(date); setViewMode("day"); }}
            now={now}
          />
        )}
      </div>

      {/* FAB — floating add button */}
      <button
        onClick={() => setShowAddEvent(true)}
        className="fixed bottom-8 right-8 md:bottom-8 md:right-8 w-14 h-14 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center z-30"
        style={{ bottom: "max(2rem, env(safe-area-inset-bottom, 0px) + 4.5rem)" }}
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>

      {/* Modals */}
      {showAddEvent && (
        <AddEventModal
          members={members}
          date={selectedDate}
          onAdd={handleAddEvent}
          onClose={() => setShowAddEvent(false)}
        />
      )}
      {editingEvent && (
        <AddEventModal
          members={members}
          date={new Date(editingEvent.start_time)}
          event={editingEvent}
          onAdd={handleUpdateEvent}
          onClose={() => setEditingEvent(null)}
        />
      )}
    </div>
  );
}

// ── Week Time Grid ──────────────────────────────────────────────

const W_HOUR_HEIGHT = 64; // px per hour
const W_START = 7;        // 7 AM
const W_END = 19;         // 7 PM
const W_HOURS = W_END - W_START;
const ALL_DAY_LANE_H = 24; // px per all-day event lane

function isAllDayEvent(evt: CalendarEvent): boolean {
  const s = new Date(evt.start_time);
  const e = new Date(evt.end_time);
  return (
    s.getUTCHours() === 0 && s.getUTCMinutes() === 0 && s.getUTCSeconds() === 0 &&
    e.getUTCHours() === 0 && e.getUTCMinutes() === 0 && e.getUTCSeconds() === 0 &&
    e.getTime() - s.getTime() >= 86400000
  );
}

function WeekView({
  weekDays,
  events,
  members,
  onDayClick,
  now,
}: {
  weekDays: { date: Date; events: CalendarEvent[] }[];
  events: CalendarEvent[];
  members: FamilyMember[];
  onDayClick: (date: Date) => void;
  now: Date;
}) {
  const hourLabels = Array.from({ length: W_HOURS + 1 }, (_, i) => W_START + i);

  // ── All-day event layout ──────────────────────────────────────
  const weekStartDate = weekDays[0].date;
  const weekEndDate = addDays(weekDays[6].date, 1); // exclusive
  const MS_PER_DAY = 86400000;

  const allDayEvts = events.filter(isAllDayEvent).filter((evt) => {
    const s = new Date(evt.start_time);
    const e = new Date(evt.end_time);
    return s < weekEndDate && e > weekStartDate;
  });

  // Sort by start date, then longer events first
  allDayEvts.sort((a, b) => {
    const d = new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
    return d !== 0 ? d : new Date(b.end_time).getTime() - new Date(a.end_time).getTime();
  });

  type AllDayLayout = { evt: CalendarEvent; lane: number; startCol: number; spanCols: number };
  const allDayLayouts: AllDayLayout[] = [];
  const laneEndCols: number[] = [];

  for (const evt of allDayEvts) {
    const s = new Date(evt.start_time);
    const e = new Date(evt.end_time);
    const startCol = Math.max(0, Math.round((s.getTime() - weekStartDate.getTime()) / MS_PER_DAY));
    const endCol = Math.min(7, Math.round((e.getTime() - weekStartDate.getTime()) / MS_PER_DAY));
    const spanCols = endCol - startCol;
    if (spanCols <= 0) continue;
    let lane = laneEndCols.findIndex((ec) => ec <= startCol);
    if (lane === -1) { lane = laneEndCols.length; laneEndCols.push(endCol); }
    else { laneEndCols[lane] = endCol; }
    allDayLayouts.push({ evt, lane, startCol, spanCols });
  }

  const numLanes = laneEndCols.length;
  const allDayRowHeight = numLanes > 0 ? numLanes * ALL_DAY_LANE_H + 6 : 0;

  const getEventPos = (event: CalendarEvent, colDate: Date) => {
    const start = new Date(event.start_time);
    const end = new Date(event.end_time);
    const colStart = new Date(colDate.getFullYear(), colDate.getMonth(), colDate.getDate());
    const colEnd = new Date(colDate.getFullYear(), colDate.getMonth(), colDate.getDate() + 1);
    if (start >= colEnd || end <= colStart) return null;
    const startMins = start < colStart ? 0 : start.getHours() * 60 + start.getMinutes();
    const endMins = end >= colEnd ? W_END * 60 : end.getHours() * 60 + end.getMinutes();
    if (startMins >= W_END * 60) return null;
    const top = Math.max((startMins - W_START * 60) / 60 * W_HOUR_HEIGHT, 0);
    const visibleStart = Math.max(startMins, W_START * 60);
    const visibleEnd = Math.min(Math.max(endMins, startMins + 30), W_END * 60);
    const height = visibleEnd > visibleStart
      ? Math.max((visibleEnd - visibleStart) / 60 * W_HOUR_HEIGHT, 22)
      : 22;
    return { top, height };
  };

  const nowMins = now.getHours() * 60 + now.getMinutes();
  const nowTop = (nowMins - W_START * 60) / 60 * W_HOUR_HEIGHT;
  const showNowLine = nowMins >= W_START * 60 && nowMins < W_END * 60;

  return (
    <div className="flex flex-col border border-gray-100 rounded-2xl overflow-hidden bg-white">
      {/* Day headers */}
      <div className="flex border-b border-gray-100">
        <div className="w-14 flex-shrink-0 border-r border-gray-100" />
        {weekDays.map(({ date }) => (
          <button
            key={date.toISOString()}
            onClick={() => onDayClick(date)}
            className={`flex-1 py-3 text-center hover:bg-gray-50 transition-colors ${isToday(date) ? "bg-indigo-50/50" : ""}`}
          >
            <span className="text-xs text-gray-400 uppercase block">{format(date, "EEE")}</span>
            <span className={`text-lg font-semibold ${isToday(date) ? "text-indigo-500" : "text-gray-800"}`}>
              {format(date, "d")}
            </span>
          </button>
        ))}
      </div>

      {/* All-day events row */}
      {allDayLayouts.length > 0 && (
        <div className="flex border-b border-gray-100" style={{ minHeight: allDayRowHeight + 4 }}>
          <div className="w-14 flex-shrink-0 border-r border-gray-100 flex items-start justify-end pr-2 pt-1.5">
            <span className="text-[10px] text-gray-400 leading-none">all-day</span>
          </div>
          <div className="flex-1 relative" style={{ height: allDayRowHeight }}>
            {allDayLayouts.map(({ evt, lane, startCol, spanCols }) => {
              const member = members.find((m) => evt.assignee_ids.includes(m.id));
              const color = evt.color || member?.color || "#6366F1";
              return (
                <div
                  key={evt.id}
                  className="absolute rounded-md px-1.5 overflow-hidden"
                  style={{
                    left: `calc(${(startCol / 7) * 100}% + 2px)`,
                    width: `calc(${(spanCols / 7) * 100}% - 4px)`,
                    top: lane * ALL_DAY_LANE_H + 3,
                    height: ALL_DAY_LANE_H - 4,
                    backgroundColor: color,
                  }}
                  title={evt.title}
                >
                  <p className="text-[11px] font-semibold leading-none truncate flex items-center h-full" style={{ color: getMemberTextColor(color) }}>
                    {evt.title}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scrollable grid */}
      <div className="flex overflow-y-auto" style={{ maxHeight: "calc(100vh - 210px)" }}>
        {/* Time labels */}
        <div className="w-14 flex-shrink-0 border-r border-gray-100 relative bg-white" style={{ height: W_HOURS * W_HOUR_HEIGHT }}>
          {hourLabels.map((h) => (
            <div
              key={h}
              className="absolute right-2 text-[11px] text-gray-400 leading-none select-none"
              style={{ top: (h - W_START) * W_HOUR_HEIGHT - 6 }}
            >
              {h === 12 ? "12 PM" : h < 12 ? `${h} AM` : `${h - 12} PM`}
            </div>
          ))}
        </div>

        {/* Day columns */}
        <div className="flex flex-1">
          {weekDays.map(({ date, events: dayEvts }, colIdx) => (
            <div
              key={date.toISOString()}
              className={`flex-1 relative ${colIdx < 6 ? "border-r border-gray-100" : ""} ${isToday(date) ? "bg-indigo-50/20" : ""}`}
              style={{ height: W_HOURS * W_HOUR_HEIGHT }}
            >
              {/* Hour lines */}
              {Array.from({ length: W_HOURS }, (_, i) => (
                <div key={i} className="absolute left-0 right-0 border-t border-gray-100" style={{ top: i * W_HOUR_HEIGHT }} />
              ))}

              {/* Current time line */}
              {isToday(date) && showNowLine && (
                <div className="absolute left-0 right-0 z-20 flex items-center" style={{ top: nowTop }}>
                  <div className="w-2 h-2 rounded-full bg-indigo-500 -ml-1 flex-shrink-0" />
                  <div className="flex-1 h-px bg-indigo-500" />
                </div>
              )}

              {/* Events */}
              {dayEvts.filter((e) => !isAllDayEvent(e)).map((evt) => {
                const pos = getEventPos(evt, date);
                if (!pos) return null;
                const member = members.find((m) => evt.assignee_ids.includes(m.id));
                const color = evt.color || member?.color || "#6366F1";
                const isIcal = evt.source === "ical";
                const isFamilyCal = evt.source === "family-ical";
                const isMeal = evt.source === "meal";
                return (
                  <div
                    key={evt.id}
                    className="absolute left-0.5 right-0.5 rounded-md px-1.5 py-0.5 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity z-10"
                    style={{ top: pos.top, height: pos.height, backgroundColor: color }}
                    title={`${evt.title} — ${format(new Date(evt.start_time), "h:mm a")}`}
                  >
                    <p className="text-[11px] font-semibold leading-tight truncate" style={{ color: getMemberTextColor(color) }}>
                      {isIcal && "🔗 "}{isFamilyCal && "👨‍👩‍👧‍👦 "}{isMeal && "🍽 "}{evt.title}
                    </p>
                    {pos.height >= 34 && (
                      <p className="text-[10px] leading-tight opacity-80 truncate" style={{ color: getMemberTextColor(color) }}>
                        {format(new Date(evt.start_time), "h:mm a")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Day Time Grid ──────────────────────────────────────────────

function fmtHour(h: number): string {
  const h24 = h % 24;
  if (h24 === 0) return "12 AM";
  if (h24 === 12) return "12 PM";
  return h24 < 12 ? `${h24} AM` : `${h24 - 12} PM`;
}

function DayView({
  events,
  members,
  onEdit,
  now,
  selectedDate,
}: {
  events: CalendarEvent[];
  members: FamilyMember[];
  onEdit: (e: CalendarEvent) => void;
  onDelete: (id: string) => void;
  now: Date;
  selectedDate: Date;
}) {
  const [startHour, setStartHour] = useState(W_START);
  const [endHour, setEndHour] = useState(W_END);
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtTop(el.scrollTop <= 0);
    setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
  };

  // Reset range and auto-scroll to (currentHour - 1) when date changes
  useEffect(() => {
    setStartHour(W_START);
    setEndHour(W_END);
    // Scroll after next paint so layout is ready
    requestAnimationFrame(() => {
      if (!scrollRef.current) return;
      const isToday = isSameDay(selectedDate, now);
      const target = isToday ? Math.max(now.getHours() - 1, W_START) : W_START;
      scrollRef.current.scrollTop = Math.max((target - W_START) * W_HOUR_HEIGHT, 0);
      const el = scrollRef.current;
      setAtTop(el.scrollTop <= 0);
      setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
    });
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleShowEarlier = () => {
    const delta = Math.min(startHour, 3);
    if (delta === 0) return;
    setStartHour((h) => h - delta);
    // After re-render, push scrollTop down so the currently-visible time stays on screen
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop += delta * W_HOUR_HEIGHT;
    });
  };

  const handleShowLater = () => setEndHour((h) => Math.min(h + 3, 24));

  if (members.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-5xl mb-4">&#128106;</p>
        <h3 className="text-xl font-semibold text-gray-900 mb-1">Add family members first</h3>
        <p className="text-gray-500">Go to Settings to add family members, then events will show in columns.</p>
      </div>
    );
  }

  const visibleHours = endHour - startHour;
  const hourLabels = Array.from({ length: visibleHours + 1 }, (_, i) => startHour + i);
  const isViewingToday = isSameDay(selectedDate, now);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const nowTop = (nowMins - startHour * 60) / 60 * W_HOUR_HEIGHT;
  const showNowLine = isViewingToday && nowMins >= startHour * 60 && nowMins < endHour * 60;

  const viewDayStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
  const viewDayEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 1);

  const getEventPos = (event: CalendarEvent): { top: number; height: number } | null => {
    const start = new Date(event.start_time);
    const end = new Date(event.end_time);
    if (start >= viewDayEnd || end <= viewDayStart) return null;
    const sMins = start < viewDayStart ? 0 : start.getHours() * 60 + start.getMinutes();
    const eMins = end >= viewDayEnd ? endHour * 60 : end.getHours() * 60 + end.getMinutes();
    if (sMins >= endHour * 60) return null;
    const top = Math.max((sMins - startHour * 60) / 60 * W_HOUR_HEIGHT, 0);
    const visStart = Math.max(sMins, startHour * 60);
    const visEnd = Math.min(Math.max(eMins, sMins + 30), endHour * 60);
    const height = visEnd > visStart
      ? Math.max((visEnd - visStart) / 60 * W_HOUR_HEIGHT, 22)
      : 22;
    return { top, height };
  };

  const familyEvents = events.filter((e) => e.assignee_ids.length === 0);

  return (
    <div className="flex flex-col border border-gray-100 rounded-2xl overflow-hidden bg-white">
      {/* Column headers */}
      <div className="flex border-b border-gray-100">
        <div className="w-14 flex-shrink-0 border-r border-gray-100" />
        {members.map((member, i) => (
          <div
            key={member.id}
            className={`flex-1 py-2 flex items-center justify-center ${i < members.length - 1 ? "border-r border-gray-100" : ""}`}
          >
            <div className="rounded-full px-3 h-8 flex items-center justify-center text-xs font-bold gap-1.5"
              style={{ backgroundColor: member.color, color: getMemberTextColor(member.color) }}>
              {member.name}
            </div>
          </div>
        ))}
      </div>

      {/* All-day events banner */}
      {(() => {
        const allDay = events.filter(isAllDayEvent);
        if (allDay.length === 0) return null;
        return (
          <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-gray-100 bg-gray-50/60">
            <span className="text-[10px] text-gray-400 font-medium self-center mr-1">all-day</span>
            {allDay.map((evt) => {
              const member = members.find((m) => evt.assignee_ids.includes(m.id));
              const color = evt.color || member?.color || "#6366F1";
              return (
                <div
                  key={evt.id}
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-md truncate max-w-xs"
                  style={{ backgroundColor: color, color: getMemberTextColor(color) }}
                  title={evt.title}
                >
                  {evt.source === "ical" && "🔗 "}{evt.source === "family-ical" && "👨‍👩‍👧‍👦 "}{evt.title}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Show earlier CTA */}
      {startHour > 0 && atTop && (
        <button
          onClick={handleShowEarlier}
          className="flex items-center justify-center gap-1.5 w-full py-2 text-xs font-medium text-indigo-500 hover:bg-indigo-50 border-b border-gray-100 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          </svg>
          Show earlier &mdash; {fmtHour(Math.max(startHour - 3, 0))} to {fmtHour(startHour)}
        </button>
      )}

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="flex overflow-y-auto" style={{ maxHeight: "calc(100vh - 220px)" }} onScroll={handleScroll}>
        {/* Time labels */}
        <div className="w-14 flex-shrink-0 border-r border-gray-100 relative bg-white" style={{ height: visibleHours * W_HOUR_HEIGHT }}>
          {hourLabels.map((h) => (
            <div key={h} className="absolute right-2 text-[11px] text-gray-400 leading-none select-none"
              style={{ top: (h - startHour) * W_HOUR_HEIGHT - 6 }}>
              {fmtHour(h)}
            </div>
          ))}
        </div>

        {/* Columns */}
        <div className="flex flex-1">
          {members.map((member, colIdx) => {
            const memberEvents = events.filter((e) => e.assignee_ids.includes(member.id));
            const colEvents = [...familyEvents, ...memberEvents];
            return (
              <div key={member.id}
                className={`flex-1 relative ${colIdx < members.length - 1 ? "border-r border-gray-100" : ""}`}
                style={{ height: visibleHours * W_HOUR_HEIGHT }}>
                {/* Hour lines */}
                {Array.from({ length: visibleHours }, (_, i) => (
                  <div key={i} className="absolute left-0 right-0 border-t border-gray-100" style={{ top: i * W_HOUR_HEIGHT }} />
                ))}
                {/* Current time line */}
                {showNowLine && (
                  <div className="absolute left-0 right-0 z-20 flex items-center pointer-events-none" style={{ top: nowTop }}>
                    <div className="w-2 h-2 rounded-full bg-indigo-500 -ml-1 flex-shrink-0" />
                    <div className="flex-1 h-px bg-indigo-500" />
                  </div>
                )}
                {/* Events */}
                {colEvents.filter((e) => !isAllDayEvent(e)).map((evt) => {
                  const pos = getEventPos(evt);
                  if (!pos) return null;
                  const isLocal = evt.source === "local" || !evt.source;
                  const color = member.color;
                  const textColor = getMemberTextColor(color);
                  return (
                    <div key={evt.id}
                      className={`absolute left-0.5 right-0.5 rounded-lg px-2 py-1 overflow-hidden z-10 transition-opacity ${isLocal ? "cursor-pointer hover:opacity-80" : ""}`}
                      style={{ top: pos.top, height: pos.height, backgroundColor: color }}
                      onClick={isLocal ? () => onEdit(evt) : undefined}
                      title={`${evt.title} — ${format(new Date(evt.start_time), "h:mm a")}`}>
                      <p className="text-xs font-semibold leading-tight truncate" style={{ color: textColor }}>
                        {evt.source === "ical" && "🔗 "}
                        {evt.source === "family-ical" && "👨‍👩‍👧‍👦 "}
                        {evt.source === "meal" && "🍽 "}
                        {evt.title}
                      </p>
                      {pos.height >= 34 && (
                        <p className="text-[10px] leading-tight opacity-80 truncate" style={{ color: textColor }}>
                          {format(new Date(evt.start_time), "h:mm a")}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Show later CTA */}
      {endHour < 24 && atBottom && (
        <button
          onClick={handleShowLater}
          className="flex items-center justify-center gap-1.5 w-full py-2 text-xs font-medium text-indigo-500 hover:bg-indigo-50 border-t border-gray-100 transition-colors"
        >
          Show later &mdash; {fmtHour(endHour)} to {fmtHour(Math.min(endHour + 3, 24))}
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ── Month Grid ──────────────────────────────────────────────────

const MAX_EVENTS_PER_DAY = 3;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function MonthView({
  selectedDate,
  events,
  members,
  onDayClick,
  now,
}: {
  selectedDate: Date;
  events: CalendarEvent[];
  members: FamilyMember[];
  onDayClick: (date: Date) => void;
  now: Date;
}) {
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  // Build array of all days in the grid
  const days: Date[] = [];
  for (let d = new Date(gridStart); d <= gridEnd; d = addDays(d, 1)) {
    days.push(new Date(d));
  }
  // Split into weeks
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <div
      className="flex flex-col border border-gray-100 rounded-2xl overflow-hidden bg-white"
      style={{ height: "calc(100vh - 165px)" }}
    >
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-gray-100 flex-shrink-0">
        {DAY_NAMES.map((name) => (
          <div key={name} className="py-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">
            {name}
          </div>
        ))}
      </div>

      {/* Week rows — fill remaining height equally */}
      <div
        className="flex-1 grid min-h-0"
        style={{ gridTemplateRows: `repeat(${weeks.length}, 1fr)` }}
      >
        {weeks.map((week, wi) => (
          <div
            key={wi}
            className={`grid grid-cols-7 ${wi < weeks.length - 1 ? "border-b border-gray-100" : ""}`}
          >
            {week.map((day, di) => {
              const inMonth = isSameMonth(day, selectedDate);
              const today = isSameDay(day, now);
              const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
              const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
              const dayEvts = events
                .filter((e) => {
                  const s = new Date(e.start_time);
                  const en = new Date(e.end_time);
                  return s < dayEnd && en > dayStart;
                })
                .slice(0, MAX_EVENTS_PER_DAY + 1); // +1 so we know if there's overflow
              const shown = dayEvts.slice(0, MAX_EVENTS_PER_DAY);
              const overflow = dayEvts.length - MAX_EVENTS_PER_DAY;

              return (
                <button
                  key={di}
                  onClick={() => onDayClick(day)}
                  className={`text-left p-1.5 overflow-hidden transition-colors hover:bg-indigo-50/40 focus:outline-none ${
                    di < 6 ? "border-r border-gray-100" : ""
                  } ${!inMonth ? "bg-gray-50/60" : ""}`}
                >
                  {/* Date number */}
                  <span
                    className={`text-sm font-semibold inline-flex w-6 h-6 items-center justify-center rounded-full leading-none ${
                      today
                        ? "bg-indigo-500 text-white"
                        : inMonth
                        ? "text-gray-800"
                        : "text-gray-300"
                    }`}
                  >
                    {format(day, "d")}
                  </span>

                  {/* Event chips */}
                  <div className="mt-0.5 space-y-0.5">
                    {shown.map((evt) => {
                      const member = members.find((m) => evt.assignee_ids.includes(m.id));
                      const color = evt.color || member?.color || "#6366F1";
                      const textColor = getMemberTextColor(color);
                      const isMeal = evt.source === "meal";
                      return (
                        <div
                          key={evt.id}
                          className="text-[10px] font-medium px-1 py-px rounded leading-tight truncate"
                          style={{ backgroundColor: color, color: textColor }}
                          title={evt.title}
                        >
                          {isMeal ? "🍽 " : ""}{evt.title}
                        </div>
                      );
                    })}
                    {overflow > 0 && (
                      <p className="text-[10px] text-indigo-400 font-medium pl-0.5">
                        +{overflow} more
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
