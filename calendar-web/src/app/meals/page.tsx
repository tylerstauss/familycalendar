"use client";

import { useState, useEffect, useRef } from "react";
import { Meal, MealPlan, FamilyMember } from "@/lib/types";
import { format, addDays } from "date-fns";

export default function MealsPage() {
  const [savedMeals, setSavedMeals] = useState<Meal[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);

  const [today] = useState(() => new Date());
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const weekStartStr = format(today, "yyyy-MM-dd");
  const weekEndStr = format(addDays(today, 6), "yyyy-MM-dd");

  const fetchMealPlans = async () => {
    const res = await fetch(`/api/meal-plans?start=${weekStartStr}&end=${weekEndStr}`);
    if (res.ok) setMealPlans(await res.json());
  };

  const fetchSavedMeals = async () => {
    const res = await fetch("/api/meals");
    if (res.ok) setSavedMeals(await res.json());
  };

  useEffect(() => {
    fetch("/api/members").then((r) => r.json()).then(setMembers);
    fetchSavedMeals();
    fetchMealPlans();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const assignMeal = async (
    date: string,
    mealType: string,
    mealName: string,
    mealId?: string,
    assigneeIds: string[] = []
  ) => {
    const res = await fetch("/api/meal-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        meal_type: mealType,
        food_item_id: mealId,
        food_name: mealName,
        assignee_ids: assigneeIds,
      }),
    });
    if (res.ok) await fetchMealPlans();
  };

  const removeMealPlan = async (id: string) => {
    await fetch("/api/meal-plans", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await fetchMealPlans();
  };

  return (
    <div className="pb-4">
      <header className="border-b border-gray-100 px-4 md:px-8 py-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">Meals</h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 md:px-8 py-6">
        <WeeklyMealPlan
          weekDays={weekDays}
          mealPlans={mealPlans}
          savedMeals={savedMeals}
          members={members}
          onAssign={assignMeal}
          onRemove={removeMealPlan}
        />
      </div>
    </div>
  );
}

// ── Weekly Meal Plan ──────────────────────────────────

function WeeklyMealPlan({
  weekDays,
  mealPlans,
  savedMeals,
  members,
  onAssign,
  onRemove,
}: {
  weekDays: Date[];
  mealPlans: MealPlan[];
  savedMeals: Meal[];
  members: FamilyMember[];
  onAssign: (date: string, mealType: string, mealName: string, mealId?: string, assigneeIds?: string[]) => void;
  onRemove: (id: string) => void;
}) {
  const mealTypes = ["breakfast", "lunch", "dinner"] as const;
  const memberMap = new Map(members.map((m) => [m.id, m]));

  return (
    <div className="space-y-4">
      {weekDays.map((day) => {
        const dateStr = format(day, "yyyy-MM-dd");
        const dayPlans = mealPlans.filter((p) => p.date === dateStr);

        return (
          <div key={dateStr} className="bg-white rounded-2xl border border-gray-100 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">{format(day, "EEEE, MMM d")}</h3>
            <div className="grid grid-cols-3 gap-3">
              {mealTypes.map((type) => {
                const typePlans = dayPlans.filter((p) => p.meal_type === type);
                return (
                  <div key={type} className="space-y-1.5">
                    <p className="text-xs text-gray-400 uppercase">{type}</p>

                    {typePlans.map((plan) => {
                      const assignedMembers = plan.assignee_ids
                        .map((id) => memberMap.get(id))
                        .filter(Boolean) as FamilyMember[];
                      return (
                        <div
                          key={plan.id}
                          className="bg-gray-50 rounded-xl p-2 flex items-start justify-between gap-1"
                        >
                          <div className="min-w-0">
                            <span className="text-sm font-medium text-gray-800 block truncate">
                              {plan.food_name}
                            </span>
                            {assignedMembers.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {assignedMembers.map((m) => (
                                  <span
                                    key={m.id}
                                    className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                                    style={{ backgroundColor: m.color, color: "#374151" }}
                                  >
                                    {m.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => onRemove(plan.id)}
                            className="text-gray-400 hover:text-red-500 p-1 shrink-0 -mt-0.5 -mr-0.5 rounded-lg"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}

                    <MealPicker
                      savedMeals={savedMeals}
                      members={members}
                      onSelect={(name, id, assigneeIds) => onAssign(dateStr, type, name, id, assigneeIds)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Meal Picker ───────────────────────────────────────

function MealPicker({
  savedMeals,
  members,
  onSelect,
}: {
  savedMeals: Meal[];
  members: FamilyMember[];
  onSelect: (name: string, id?: string, assigneeIds?: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [custom, setCustom] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const close = () => {
    setOpen(false);
    setSearch("");
    setCustom("");
    setSelectedMemberIds([]);
  };

  const toggleMember = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const pick = (name: string, id?: string) => {
    onSelect(name, id, selectedMemberIds);
    close();
  };

  const filtered = savedMeals.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full border border-dashed border-gray-200 rounded-xl p-2 text-sm text-gray-400 hover:text-gray-600 hover:border-gray-300"
      >
        + Add
      </button>
    );
  }

  return (
    <div ref={containerRef} className="bg-white border border-gray-200 rounded-xl shadow-lg p-2 space-y-1.5">
      {/* Member selector (multi-select) */}
      {members.length > 0 && (
        <div className="flex flex-wrap gap-1 pb-1.5 border-b border-gray-100">
          <button
            onClick={() => setSelectedMemberIds([])}
            className={`text-xs px-2 py-1 rounded-full border transition-colors ${
              selectedMemberIds.length === 0
                ? "bg-gray-700 text-white border-gray-700"
                : "text-gray-500 border-gray-200 hover:border-gray-300"
            }`}
          >
            Everyone
          </button>
          {members.map((m) => {
            const active = selectedMemberIds.includes(m.id);
            return (
              <button
                key={m.id}
                onClick={() => toggleMember(m.id)}
                className="text-xs px-2 py-1 rounded-full border-2 transition-all"
                style={
                  active
                    ? { backgroundColor: m.color, color: "#1f2937", borderColor: "#374151" }
                    : { backgroundColor: m.color + "60", color: "#6b7280", borderColor: "transparent" }
                }
              >
                {m.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Search */}
      {savedMeals.length > 5 && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded-lg text-gray-900 focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
          placeholder="Search meals..."
          autoFocus={members.length === 0}
        />
      )}

      {/* Saved meals list */}
      <div className="max-h-36 overflow-y-auto space-y-0.5">
        {filtered.length === 0 && search ? (
          <p className="text-xs text-gray-400 px-2 py-1">No matches</p>
        ) : (
          filtered.map((m) => (
            <button
              key={m.id}
              onClick={() => pick(m.name, m.id)}
              className="block w-full text-left text-sm px-2 py-1.5 rounded-lg hover:bg-indigo-50 text-gray-700 truncate"
            >
              {m.name}
            </button>
          ))
        )}
        {savedMeals.length === 0 && (
          <p className="text-xs text-gray-400 px-2 py-1">
            Create meals in{" "}
            <a href="/lists" className="text-indigo-500 underline">
              Lists
            </a>
          </p>
        )}
      </div>

      {/* Custom text + close */}
      <div className="flex gap-1 border-t border-gray-100 pt-1">
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && custom.trim()) pick(custom.trim());
          }}
          className="flex-1 text-sm px-2 py-1 border border-gray-200 rounded-lg text-gray-900"
          placeholder="Custom..."
        />
        <button
          onClick={close}
          className="text-gray-400 hover:text-gray-600 p-2 rounded-lg shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
