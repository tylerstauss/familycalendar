"use client";

import { useState, useEffect, useCallback } from "react";
import { FamilyMember, CalendarEvent, RidePlan, DriverSuggestion } from "@/lib/types";
import { getMemberTextColor } from "@/lib/types";

type PlanType = "dropoff" | "pickup";

interface ModalState {
  event: CalendarEvent;
  planType: PlanType;
}

export default function RidesPage() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [ridePlans, setRidePlans] = useState<RidePlan[]>([]);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [suggestions, setSuggestions] = useState<DriverSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [modalNotes, setModalNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    const now = new Date();
    const start = now.toISOString().slice(0, 10);
    const end = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [membersRes, eventsRes, plansRes] = await Promise.all([
      fetch("/api/members"),
      fetch(`/api/events?start=${start}&end=${end}`),
      fetch("/api/ride-plans"),
    ]);

    if (membersRes.ok) setMembers(await membersRes.json());
    if (eventsRes.ok) {
      const data: CalendarEvent[] = await eventsRes.json();
      setEvents(data);
    }
    if (plansRes.ok) setRidePlans(await plansRes.json());
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const kids = members.filter((m) => m.member_type === "kid");
  const adults = members.filter((m) => m.member_type !== "kid");

  // Events that have a location AND have at least one kid assigned
  const rideEvents = events.filter((e) => {
    if (!e.location?.trim()) return false;
    if (e.source && e.source !== "local") return false;
    const kidIds = new Set(kids.map((k) => k.id));
    return (e.assignee_ids || []).some((id) => kidIds.has(id));
  });

  function getMember(id: string) {
    return members.find((m) => m.id === id);
  }

  function getPlan(eventId: string, type: PlanType): RidePlan | undefined {
    return ridePlans.find((p) => p.event_id === eventId && p.plan_type === type);
  }

  async function openPlanModal(event: CalendarEvent, planType: PlanType) {
    setModal({ event, planType });
    setSelectedDriver(null);
    setModalNotes("");
    setSuggestions([]);
    setSuggestionsLoading(true);

    const adultIds = adults.map((a) => a.id);
    try {
      const res = await fetch("/api/ride-plans/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_location: event.location, adult_member_ids: adultIds }),
      });
      if (res.ok) setSuggestions(await res.json());
    } catch {}
    setSuggestionsLoading(false);
  }

  async function savePlan() {
    if (!modal || !selectedDriver) return;
    setSaving(true);
    const suggestion = suggestions.find((s) => s.memberId === selectedDriver);
    await fetch("/api/ride-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: modal.event.id,
        plan_type: modal.planType,
        driver_id: selectedDriver,
        passengers: kids.filter((k) => (modal.event.assignee_ids || []).includes(k.id)).map((k) => k.id),
        drive_mins: suggestion?.drive_mins ?? null,
        drive_km: suggestion?.drive_km ?? null,
        notes: modalNotes,
      }),
    });
    setSaving(false);
    setModal(null);
    fetchAll();
  }

  async function deletePlan(id: string) {
    await fetch("/api/ride-plans", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchAll();
  }

  function formatEventTime(event: CalendarEvent) {
    const start = new Date(event.start_time);
    return start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) +
      " · " + start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  return (
    <div className="pb-24 md:pb-6">
      <header className="border-b border-gray-100 px-4 md:px-8 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">Rides</h1>
          <p className="text-sm text-gray-400 mt-0.5">Plan pickups and dropoffs for upcoming events</p>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 md:px-8 py-6 space-y-4">
        {rideEvents.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
            </svg>
            <p className="text-sm font-medium">No upcoming events need rides</p>
            <p className="text-xs mt-1">Events with a location and kid passengers will appear here</p>
          </div>
        ) : (
          rideEvents.map((event) => {
            const eventKids = kids.filter((k) => (event.assignee_ids || []).includes(k.id));
            const dropoffPlan = getPlan(event.id, "dropoff");
            const pickupPlan = getPlan(event.id, "pickup");

            return (
              <div key={event.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {/* Event header */}
                <div className="p-4 border-b border-gray-50">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">{event.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatEventTime(event)}</p>
                      <p className="text-xs text-indigo-500 mt-0.5 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                        {event.location}
                      </p>
                    </div>
                    {/* Kid avatars */}
                    <div className="flex -space-x-1.5 flex-shrink-0">
                      {eventKids.map((k) => (
                        <div
                          key={k.id}
                          className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold"
                          style={{ backgroundColor: k.color, color: getMemberTextColor(k.color) }}
                          title={k.name}
                        >
                          {k.name[0].toUpperCase()}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Dropoff / Pickup rows */}
                <div className="divide-y divide-gray-50">
                  {(["dropoff", "pickup"] as PlanType[]).map((type) => {
                    const plan = type === "dropoff" ? dropoffPlan : pickupPlan;
                    const driver = plan ? getMember(plan.driver_id) : null;
                    return (
                      <div key={type} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-400 w-16 uppercase tracking-wide">
                            {type === "dropoff" ? "Drop-off" : "Pick-up"}
                          </span>
                          {plan && driver ? (
                            <div className="flex items-center gap-2">
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                                style={{ backgroundColor: driver.color, color: getMemberTextColor(driver.color) }}
                              >
                                {driver.name[0].toUpperCase()}
                              </div>
                              <span className="text-sm text-gray-800 font-medium">{driver.name}</span>
                              {plan.drive_mins !== null && (
                                <span className="text-xs bg-green-50 text-green-600 font-medium px-2 py-0.5 rounded-full">
                                  ~{plan.drive_mins} min
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-300">Not planned</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {plan ? (
                            <button
                              onClick={() => deletePlan(plan.id)}
                              className="text-xs text-gray-300 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                            >
                              Remove
                            </button>
                          ) : null}
                          <button
                            onClick={() => openPlanModal(event, type)}
                            className="text-xs font-medium text-indigo-500 hover:text-indigo-700 border border-indigo-200 hover:border-indigo-400 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            {plan ? "Change" : "+ Plan"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Plan Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModal(null)} />
          <div className="relative bg-white w-full max-w-md md:rounded-2xl rounded-t-2xl p-5 md:mx-4 max-h-[90vh] overflow-y-auto">
            <div className="mb-4">
              <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-1">
                {modal.planType === "dropoff" ? "Plan Drop-off" : "Plan Pick-up"}
              </p>
              <p className="font-bold text-gray-900 text-lg">{modal.event.title}</p>
              <p className="text-sm text-gray-400 flex items-center gap-1 mt-0.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                {modal.event.location}
              </p>
            </div>

            <p className="text-sm font-semibold text-gray-700 mb-3">Choose Driver</p>

            {suggestionsLoading ? (
              <div className="space-y-2 mb-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2 mb-4">
                {suggestions.map((s, idx) => {
                  const member = getMember(s.memberId);
                  const isFirst = idx === 0 && s.drive_mins !== null;
                  const isSelected = selectedDriver === s.memberId;
                  return (
                    <button
                      key={s.memberId}
                      onClick={() => setSelectedDriver(s.memberId)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors text-left ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-gray-100 hover:border-gray-200 bg-white"
                      }`}
                    >
                      {member && (
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                          style={{ backgroundColor: member.color, color: getMemberTextColor(member.color) }}
                        >
                          {member.name[0].toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm">{s.name}</p>
                        {s.home_address ? (
                          <p className="text-xs text-gray-400 truncate">{s.home_address}</p>
                        ) : (
                          <p className="text-xs text-gray-300">No address</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isFirst && (
                          <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                            Closest
                          </span>
                        )}
                        {s.drive_mins !== null ? (
                          <span className="text-xs font-medium text-gray-500">~{s.drive_mins} min</span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </div>
                    </button>
                  );
                })}
                {adults.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">No adult members found</p>
                )}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={modalNotes}
                onChange={(e) => setModalNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 text-gray-900 text-sm resize-none"
                placeholder="Optional notes..."
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setModal(null)}
                className="flex-1 px-4 py-2.5 text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={savePlan}
                disabled={!selectedDriver || saving}
                className="flex-1 px-4 py-2.5 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : "Save Plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
