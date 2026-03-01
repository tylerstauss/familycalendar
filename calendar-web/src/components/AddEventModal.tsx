"use client";

import { useState, useEffect } from "react";
import { FamilyMember, CalendarEvent, getMemberTextColor } from "@/lib/types";
import { format } from "date-fns";

type RepeatMode = "none" | "daily" | "weekly" | "monthly" | "yearly";
type RepeatEnd = "never" | "count" | "until";

const WEEKDAYS = [
  { key: "MO", label: "M" },
  { key: "TU", label: "T" },
  { key: "WE", label: "W" },
  { key: "TH", label: "T" },
  { key: "FR", label: "F" },
  { key: "SA", label: "S" },
  { key: "SU", label: "S" },
];

function detectAllDay(evt: CalendarEvent): boolean {
  const s = new Date(evt.start_time);
  const e = new Date(evt.end_time);
  return (
    s.getUTCHours() === 0 && s.getUTCMinutes() === 0 && s.getUTCSeconds() === 0 &&
    e.getUTCHours() === 0 && e.getUTCMinutes() === 0 && e.getUTCSeconds() === 0 &&
    e.getTime() - s.getTime() >= 86400000
  );
}

function parseRRule(rrule: string): {
  mode: RepeatMode; interval: number; weekdays: string[];
  endType: RepeatEnd; count: number; until: string;
} {
  const defaults = { mode: "none" as RepeatMode, interval: 1, weekdays: [] as string[], endType: "never" as RepeatEnd, count: 10, until: "" };
  if (!rrule) return defaults;
  const params: Record<string, string> = {};
  rrule.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx > 0) params[part.slice(0, idx)] = part.slice(idx + 1);
  });
  const mode = ((params.FREQ?.toLowerCase()) as RepeatMode) || "none";
  const interval = parseInt(params.INTERVAL || "1", 10);
  const weekdays = params.BYDAY ? params.BYDAY.split(",") : [];
  let endType: RepeatEnd = "never";
  let count = 10;
  let until = "";
  if (params.COUNT) { endType = "count"; count = parseInt(params.COUNT, 10); }
  else if (params.UNTIL) {
    endType = "until";
    const u = params.UNTIL.replace("Z", "").split("T")[0];
    until = `${u.slice(0, 4)}-${u.slice(4, 6)}-${u.slice(6, 8)}`;
  }
  return { mode, interval, weekdays, endType, count, until };
}

function buildRRule(mode: RepeatMode, interval: number, weekdays: string[], endType: RepeatEnd, count: number, until: string): string {
  if (mode === "none") return "";
  let rule = `FREQ=${mode.toUpperCase()};INTERVAL=${interval}`;
  if (mode === "weekly" && weekdays.length > 0) rule += `;BYDAY=${weekdays.join(",")}`;
  if (endType === "count") rule += `;COUNT=${count}`;
  else if (endType === "until" && until) rule += `;UNTIL=${until.replace(/-/g, "")}T000000Z`;
  return rule;
}

interface AddEventModalProps {
  members: FamilyMember[];
  date: Date;
  event?: CalendarEvent;
  onAdd: (event: Omit<CalendarEvent, "created_at"> & { id?: string }) => Promise<void>;
  onClose: () => void;
}

export default function AddEventModal({ members, date, event, onAdd, onClose }: AddEventModalProps) {
  const isEditing = !!event;
  const existingAllDay = event ? detectAllDay(event) : false;
  const parsed = event?.recurrence ? parseRRule(event.recurrence) : null;

  const [title, setTitle] = useState(event?.title ?? "");
  const [allDay, setAllDay] = useState(existingAllDay);

  const [startDate, setStartDate] = useState(() => {
    if (event) return format(new Date(event.start_time), "yyyy-MM-dd");
    return format(date, "yyyy-MM-dd");
  });
  const [startTime, setStartTime] = useState(() => {
    if (event && !existingAllDay) return format(new Date(event.start_time), "HH:mm");
    return "09:00";
  });
  const [endDate, setEndDate] = useState(() => {
    if (event) {
      if (existingAllDay) {
        // end is exclusive midnight — subtract 1 day for display
        const d = new Date(event.end_time);
        d.setUTCDate(d.getUTCDate() - 1);
        return format(d, "yyyy-MM-dd");
      }
      return format(new Date(event.end_time), "yyyy-MM-dd");
    }
    return format(date, "yyyy-MM-dd");
  });
  const [endTime, setEndTime] = useState(() => {
    if (event && !existingAllDay) return format(new Date(event.end_time), "HH:mm");
    return "10:00";
  });

  const [repeatMode, setRepeatMode] = useState<RepeatMode>(parsed?.mode ?? "none");
  const [repeatInterval, setRepeatInterval] = useState(parsed?.interval ?? 1);
  const [repeatWeekdays, setRepeatWeekdays] = useState<string[]>(parsed?.weekdays ?? []);
  const [repeatEndType, setRepeatEndType] = useState<RepeatEnd>(parsed?.endType ?? "never");
  const [repeatCount, setRepeatCount] = useState(parsed?.count ?? 10);
  const [repeatUntil, setRepeatUntil] = useState(parsed?.until ?? "");

  const [location, setLocation] = useState(event?.location ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>(event?.assignee_ids ?? []);
  const [saving, setSaving] = useState(false);

  // Auto-seed weekday from start date when switching to weekly
  useEffect(() => {
    if (repeatMode === "weekly" && repeatWeekdays.length === 0 && startDate) {
      const d = new Date(`${startDate}T12:00:00`);
      const keys = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
      setRepeatWeekdays([keys[d.getDay()]]);
    }
  }, [repeatMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep end date >= start date
  useEffect(() => {
    if (endDate < startDate) setEndDate(startDate);
  }, [startDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleAssignee = (id: string) =>
    setSelectedAssignees((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const toggleWeekday = (key: string) =>
    setRepeatWeekdays((prev) => prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      let start_time: string;
      let end_time: string;

      if (allDay) {
        start_time = `${startDate}T00:00:00.000Z`;
        // store exclusive end (add 1 day)
        const endD = new Date(`${endDate}T00:00:00.000Z`);
        endD.setUTCDate(endD.getUTCDate() + 1);
        end_time = endD.toISOString();
      } else {
        start_time = new Date(`${startDate}T${startTime}:00`).toISOString();
        end_time = new Date(`${endDate}T${endTime}:00`).toISOString();
      }

      const recurrence = buildRRule(repeatMode, repeatInterval, repeatWeekdays, repeatEndType, repeatCount, repeatUntil);

      await onAdd({
        id: event?.id ?? "",
        title: title.trim(),
        start_time,
        end_time,
        location,
        notes,
        assignee_ids: selectedAssignees,
        recurrence,
      });
      onClose();
    } catch (err) {
      console.error("Failed to save event:", err);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 text-gray-900 text-sm bg-white";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1";
  const repeatUnitLabel = repeatMode === "daily" ? "day(s)" : repeatMode === "weekly" ? "week(s)" : repeatMode === "monthly" ? "month(s)" : "year(s)";

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl w-full max-w-md shadow-xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <h2 className="text-xl font-bold text-gray-900">{isEditing ? "Edit Event" : "Add Event"}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 p-5 space-y-4">

            {/* Title */}
            <div>
              <label className={labelCls}>Title</label>
              <input
                type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                className={inputCls} placeholder="Event title" autoFocus required
              />
            </div>

            {/* All-day toggle */}
            <label className="flex items-center gap-3 cursor-pointer select-none w-fit">
              <input
                type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-10 h-6 rounded-full relative transition-colors ${allDay ? "bg-indigo-500" : "bg-gray-200"}`}>
                <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${allDay ? "translate-x-4" : ""}`} />
              </div>
              <span className="text-sm font-medium text-gray-700">All day</span>
            </label>

            {/* Date / Time */}
            <div className="grid grid-cols-2 gap-3">
              <div className={allDay ? "col-span-1" : ""}>
                <label className={labelCls}>Start date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
              </div>
              {!allDay && (
                <div>
                  <label className={labelCls}>Start time</label>
                  <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
                </div>
              )}
              <div className={allDay ? "col-span-1" : ""}>
                <label className={labelCls}>End date</label>
                <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
              </div>
              {!allDay && (
                <div>
                  <label className={labelCls}>End time</label>
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
                </div>
              )}
            </div>

            {/* Repeat */}
            <div>
              <label className={labelCls}>Repeat</label>
              <select
                value={repeatMode}
                onChange={(e) => setRepeatMode(e.target.value as RepeatMode)}
                className={inputCls}
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>

              {repeatMode !== "none" && (
                <div className="mt-3 pl-1 space-y-3">
                  {/* Interval */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Every</span>
                    <input
                      type="number" min={1} max={99} value={repeatInterval}
                      onChange={(e) => setRepeatInterval(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-900 text-center focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 bg-white"
                    />
                    <span className="text-sm text-gray-600">{repeatUnitLabel}</span>
                  </div>

                  {/* Weekday picker */}
                  {repeatMode === "weekly" && (
                    <div>
                      <p className="text-sm text-gray-600 mb-1.5">On</p>
                      <div className="flex gap-1">
                        {WEEKDAYS.map(({ key, label }) => (
                          <button
                            key={key} type="button" onClick={() => toggleWeekday(key)}
                            className={`w-8 h-8 rounded-full text-xs font-semibold transition-colors ${
                              repeatWeekdays.includes(key)
                                ? "bg-indigo-500 text-white"
                                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* End condition */}
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600 font-medium">Ends</p>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="repeatEnd" value="never" checked={repeatEndType === "never"} onChange={() => setRepeatEndType("never")} className="accent-indigo-500" />
                      <span className="text-sm text-gray-700">Never</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="repeatEnd" value="count" checked={repeatEndType === "count"} onChange={() => setRepeatEndType("count")} className="accent-indigo-500" />
                      <span className="flex items-center gap-1.5 text-sm text-gray-700">
                        After
                        <input
                          type="number" min={1} max={999} value={repeatCount}
                          onChange={(e) => setRepeatCount(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-16 px-2 py-0.5 border border-gray-200 rounded-lg text-sm text-gray-900 text-center focus:ring-2 focus:ring-indigo-400 bg-white"
                        />
                        occurrences
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="repeatEnd" value="until" checked={repeatEndType === "until"} onChange={() => setRepeatEndType("until")} className="accent-indigo-500" />
                      <span className="flex items-center gap-1.5 text-sm text-gray-700">
                        On
                        <input
                          type="date" value={repeatUntil} min={startDate}
                          onChange={(e) => setRepeatUntil(e.target.value)}
                          className="px-2 py-0.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-indigo-400 bg-white"
                        />
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Location */}
            <div>
              <label className={labelCls}>Location</label>
              <input
                type="text" value={location} onChange={(e) => setLocation(e.target.value)}
                className={inputCls} placeholder="Optional"
              />
            </div>

            {/* Assign to */}
            {members.length > 0 && (
              <div>
                <label className={labelCls}>Assign to</label>
                <div className="flex flex-wrap gap-2">
                  {members.map((m) => {
                    const selected = selectedAssignees.includes(m.id);
                    const textColor = getMemberTextColor(m.color);
                    return (
                      <button
                        key={m.id} type="button" onClick={() => toggleAssignee(m.id)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                          selected ? "shadow-sm" : "bg-gray-100 hover:bg-gray-200"
                        }`}
                        style={selected ? { backgroundColor: m.color, color: textColor } : { color: "#6B7280" }}
                      >
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className={labelCls}>Notes</label>
              <textarea
                value={notes} onChange={(e) => setNotes(e.target.value)}
                className={inputCls} rows={2} placeholder="Optional"
              />
            </div>

          </div>

          {/* Footer */}
          <div className="flex gap-3 p-5 pt-3 border-t border-gray-100 shrink-0">
            <button
              type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium text-sm"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={saving || !title.trim()}
              className="flex-1 px-4 py-2.5 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 font-medium disabled:opacity-50 text-sm"
            >
              {saving ? "Saving…" : isEditing ? "Save Changes" : "Add Event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
