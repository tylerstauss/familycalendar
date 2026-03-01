"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface GoogleCalendar {
  id: string;
  summary: string;
  primary?: boolean;
}

export default function GoogleCalendarPickerPage() {
  const router = useRouter();
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/google/calendars")
      .then((r) => r.json())
      .then((data: GoogleCalendar[]) => {
        setCalendars(data);
        const primary = data.find((c) => c.primary);
        if (primary) setSelected(primary.id);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load calendars. Please try connecting again.");
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    const cal = calendars.find((c) => c.id === selected);
    await fetch("/api/auth/google/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ calendarId: selected, calendarName: cal?.summary ?? selected }),
    });
    router.push("/settings");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.5 3h-2.25V1.5h-1.5V3h-7.5V1.5h-1.5V3H4.5A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3zm0 16.5h-15V9h15v10.5zM4.5 7.5V4.5H6.75V6h1.5V4.5h7.5V6h1.5V4.5H19.5V7.5h-15z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Choose a Calendar</h2>
            <p className="text-xs text-gray-400">New events will sync here</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-7 h-7 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="py-4">
            <p className="text-sm text-red-500 mb-4">{error}</p>
            <button
              onClick={() => router.push("/settings")}
              className="w-full px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium text-sm"
            >
              Back to Settings
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-5">
              {calendars.map((cal) => (
                <label
                  key={cal.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    selected === cal.id
                      ? "border-indigo-400 bg-indigo-50"
                      : "border-gray-100 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="calendar"
                    value={cal.id}
                    checked={selected === cal.id}
                    onChange={() => setSelected(cal.id)}
                    className="accent-indigo-500"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{cal.summary}</p>
                    {cal.primary && <p className="text-xs text-indigo-400">Primary calendar</p>}
                  </div>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => router.push("/settings")}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!selected || saving}
                className="flex-1 px-4 py-2.5 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 font-medium disabled:opacity-50 text-sm"
              >
                {saving ? "Connecting…" : "Connect"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
