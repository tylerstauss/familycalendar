"use client";

import { useState } from "react";
import { FamilyMember, CalendarEvent, getMemberTextColor } from "@/lib/types";
import { format } from "date-fns";

interface AddEventModalProps {
  members: FamilyMember[];
  date: Date;
  event?: CalendarEvent; // if editing
  onAdd: (event: Omit<CalendarEvent, "created_at"> & { id?: string }) => Promise<void>;
  onClose: () => void;
}

export default function AddEventModal({ members, date, event, onAdd, onClose }: AddEventModalProps) {
  const isEditing = !!event;
  const [title, setTitle] = useState(event?.title || "");
  const [startTime, setStartTime] = useState(
    event ? format(new Date(event.start_time), "HH:mm") : "09:00"
  );
  const [endTime, setEndTime] = useState(
    event ? format(new Date(event.end_time), "HH:mm") : "10:00"
  );
  const [location, setLocation] = useState(event?.location || "");
  const [notes, setNotes] = useState(event?.notes || "");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>(event?.assignee_ids || []);
  const [saving, setSaving] = useState(false);

  const toggleAssignee = (id: string) => {
    setSelectedAssignees((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);

    try {
      const [sh, sm] = startTime.split(":").map(Number);
      const [eh, em] = endTime.split(":").map(Number);

      const start = new Date(date);
      start.setHours(sh, sm, 0, 0);
      const end = new Date(date);
      end.setHours(eh, em, 0, 0);

      await onAdd({
        id: event?.id || "",
        title: title.trim(),
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        location,
        notes,
        assignee_ids: selectedAssignees,
      });
      onClose();
    } catch (err) {
      console.error("Failed to save event:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">{isEditing ? "Edit Event" : "Add Event"}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 text-gray-900"
              placeholder="Event title" autoFocus required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 text-gray-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 text-gray-900" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 text-gray-900"
              placeholder="Optional" />
          </div>

          {members.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Assign to</label>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => {
                  const selected = selectedAssignees.includes(m.id);
                  const textColor = getMemberTextColor(m.color);
                  return (
                    <button key={m.id} type="button" onClick={() => toggleAssignee(m.id)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        selected ? "shadow-sm" : "bg-gray-100 hover:bg-gray-200"
                      }`}
                      style={selected ? { backgroundColor: m.color, color: textColor } : { color: "#6B7280" }}>
                      {m.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 text-gray-900"
              rows={2} placeholder="Optional" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium">
              Cancel
            </button>
            <button type="submit" disabled={saving || !title.trim()}
              className="flex-1 px-4 py-2.5 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 font-medium disabled:opacity-50">
              {saving ? "Saving..." : isEditing ? "Save Changes" : "Add Event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
