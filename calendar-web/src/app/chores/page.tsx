"use client";

import { useEffect, useState, useCallback } from "react";
import { Chore, ChoreCompletion, Reward, MemberStarBalance, FamilyMember } from "@/lib/types";

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function choreAppearsOn(chore: Chore, date: Date): boolean {
  if (chore.frequency === "daily") return true;
  if (chore.frequency === "weekly") return chore.week_day === date.getDay();
  if (chore.frequency === "one-time") return chore.due_date === toYMD(date);
  return false;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const FREQ_LABELS: Record<string, string> = { daily: "Daily", weekly: "Weekly", "one-time": "One-time" };

export default function ChoresPage() {
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [chores, setChores] = useState<Chore[]>([]);
  const [completions, setCompletions] = useState<ChoreCompletion[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [balances, setBalances] = useState<MemberStarBalance[]>([]);

  // Manage panel state
  const [showManage, setShowManage] = useState(false);
  const [showAddChore, setShowAddChore] = useState(false);
  const [showAddReward, setShowAddReward] = useState(false);

  // Add chore form
  const [choreForm, setChoreForm] = useState({
    name: "",
    assignee_id: "",
    frequency: "daily",
    week_day: 1,
    due_date: "",
    star_value: 1,
  });

  // Add reward form
  const [rewardForm, setRewardForm] = useState({ name: "", star_cost: 5 });

  // Redeem picker
  const [redeemingReward, setRedeemingReward] = useState<Reward | null>(null);

  const dateStr = toYMD(selectedDate);

  const loadAll = useCallback(async () => {
    const [membersRes, choresRes, completionsRes, rewardsRes, balancesRes] = await Promise.all([
      fetch("/api/members"),
      fetch("/api/chores"),
      fetch(`/api/chores/complete?date=${dateStr}`),
      fetch("/api/rewards"),
      fetch("/api/chores/stars"),
    ]);

    if (membersRes.ok) setMembers(await membersRes.json());
    if (choresRes.ok) setChores(await choresRes.json());
    if (completionsRes.ok) setCompletions(await completionsRes.json());
    if (rewardsRes.ok) setRewards(await rewardsRes.json());
    if (balancesRes.ok) setBalances(await balancesRes.json());
  }, [dateStr]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const completedIds = new Set(completions.map((c) => c.chore_id));

  function getBalance(memberId: string): number {
    return balances.find((b) => b.member_id === memberId)?.balance ?? 0;
  }

  async function toggleChore(chore: Chore, completed: boolean) {
    const body = { chore_id: chore.id, member_id: chore.assignee_id, date: dateStr };
    if (completed) {
      // Optimistic: uncheck
      setCompletions((prev) => prev.filter((c) => c.chore_id !== chore.id));
      await fetch("/api/chores/complete", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } else {
      // Optimistic: check
      setCompletions((prev) => [...prev, { id: "opt", chore_id: chore.id, member_id: chore.assignee_id, date: dateStr }]);
      await fetch("/api/chores/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }
    // Refresh balances
    const r = await fetch("/api/chores/stars");
    if (r.ok) setBalances(await r.json());
  }

  async function addChore() {
    if (!choreForm.name.trim() || !choreForm.assignee_id) return;
    const body: Record<string, unknown> = {
      name: choreForm.name,
      assignee_id: choreForm.assignee_id,
      frequency: choreForm.frequency,
      star_value: choreForm.star_value,
    };
    if (choreForm.frequency === "weekly") body.week_day = choreForm.week_day;
    if (choreForm.frequency === "one-time") body.due_date = choreForm.due_date;

    const res = await fetch("/api/chores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      const newChore = await res.json();
      setChores((prev) => [...prev, newChore]);
      setChoreForm({ name: "", assignee_id: "", frequency: "daily", week_day: 1, due_date: "", star_value: 1 });
      setShowAddChore(false);
    }
  }

  async function deleteChore(id: string) {
    await fetch("/api/chores", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setChores((prev) => prev.filter((c) => c.id !== id));
  }

  async function addReward() {
    if (!rewardForm.name.trim()) return;
    const res = await fetch("/api/rewards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rewardForm) });
    if (res.ok) {
      const newReward = await res.json();
      setRewards((prev) => [...prev, newReward]);
      setRewardForm({ name: "", star_cost: 5 });
      setShowAddReward(false);
    }
  }

  async function deleteReward(id: string) {
    await fetch("/api/rewards", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setRewards((prev) => prev.filter((r) => r.id !== id));
  }

  async function redeemReward(reward: Reward, memberId: string) {
    const res = await fetch("/api/rewards/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reward_id: reward.id, member_id: memberId }),
    });
    if (res.ok) {
      const r2 = await fetch("/api/chores/stars");
      if (r2.ok) setBalances(await r2.json());
    }
    setRedeemingReward(null);
  }

  const visibleMembers = members.filter((m) => !m.hidden);

  const labelDate = selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="min-h-screen bg-gray-50 md:ml-20 pb-24 md:pb-8">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Chores</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d); }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button
            onClick={() => { const d = new Date(); d.setHours(0, 0, 0, 0); setSelectedDate(d); }}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors px-2"
          >
            Today
          </button>
          <button
            onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d); }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>
      <div className="px-4 py-1.5 text-sm text-gray-500 bg-white border-b border-gray-100">{labelDate}</div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Member chore cards */}
        {visibleMembers.map((member) => {
          const memberChores = chores.filter((c) => c.assignee_id === member.id && choreAppearsOn(c, selectedDate));
          const balance = getBalance(member.id);

          return (
            <div key={member.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Member header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ backgroundColor: member.color, color: "#374151" }}
                >
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <span className="font-semibold text-gray-900 flex-1">{member.name}</span>
                <span className="flex items-center gap-1 text-sm font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                  ⭐ {balance}
                </span>
              </div>

              {/* Chore list */}
              <div className="divide-y divide-gray-50">
                {memberChores.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-gray-400 italic">No chores today</p>
                ) : (
                  memberChores.map((chore) => {
                    const done = completedIds.has(chore.id);
                    return (
                      <label
                        key={chore.id}
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={done}
                          onChange={() => toggleChore(chore, done)}
                          className="w-5 h-5 rounded accent-indigo-600 cursor-pointer"
                        />
                        <span className={`flex-1 text-sm font-medium ${done ? "line-through text-gray-400" : "text-gray-800"}`}>
                          {chore.name}
                        </span>
                        <span className="text-xs text-amber-500 font-medium">+{chore.star_value} ⭐</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}

        {/* Rewards section */}
        {rewards.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <h2 className="font-semibold text-gray-900">Rewards</h2>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {rewards.map((reward) => (
                <div key={reward.id} className="border border-gray-100 rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-800 text-sm">{reward.name}</span>
                    <span className="text-amber-500 text-sm font-medium">{reward.star_cost} ⭐</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {visibleMembers.map((m) => {
                      const canRedeem = getBalance(m.id) >= reward.star_cost;
                      return (
                        <button
                          key={m.id}
                          disabled={!canRedeem}
                          onClick={() => setRedeemingReward(reward)}
                          className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                            canRedeem
                              ? "bg-indigo-600 text-white hover:bg-indigo-700"
                              : "bg-gray-100 text-gray-400 cursor-not-allowed"
                          }`}
                          title={canRedeem ? `${m.name} can redeem` : `${m.name} needs more stars`}
                        >
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manage section */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowManage((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
          >
            <span className="font-semibold text-gray-700 text-sm">Manage Chores & Rewards</span>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${showManage ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {showManage && (
            <div className="border-t border-gray-50 px-4 py-4 space-y-5">
              {/* Chore management */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">Chores</h3>
                  <button
                    onClick={() => setShowAddChore((v) => !v)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    + Add Chore
                  </button>
                </div>

                {showAddChore && (
                  <div className="bg-gray-50 rounded-xl p-3 space-y-2 mb-3">
                    <input
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      placeholder="Chore name"
                      value={choreForm.name}
                      onChange={(e) => setChoreForm((f) => ({ ...f, name: e.target.value }))}
                    />
                    <select
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      value={choreForm.assignee_id}
                      onChange={(e) => setChoreForm((f) => ({ ...f, assignee_id: e.target.value }))}
                    >
                      <option value="">Assign to…</option>
                      {visibleMembers.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <select
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        value={choreForm.frequency}
                        onChange={(e) => setChoreForm((f) => ({ ...f, frequency: e.target.value }))}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="one-time">One-time</option>
                      </select>
                      {choreForm.frequency === "weekly" && (
                        <select
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          value={choreForm.week_day}
                          onChange={(e) => setChoreForm((f) => ({ ...f, week_day: parseInt(e.target.value) }))}
                        >
                          {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                        </select>
                      )}
                      {choreForm.frequency === "one-time" && (
                        <input
                          type="date"
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          value={choreForm.due_date}
                          onChange={(e) => setChoreForm((f) => ({ ...f, due_date: e.target.value }))}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500 w-20">Stars:</label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        value={choreForm.star_value}
                        onChange={(e) => setChoreForm((f) => ({ ...f, star_value: parseInt(e.target.value) || 1 }))}
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setShowAddChore(false)}
                        className="text-xs px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={addChore}
                        className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  {chores.map((chore) => {
                    const member = members.find((m) => m.id === chore.assignee_id);
                    return (
                      <div key={chore.id} className="flex items-center gap-2 py-1.5 text-sm text-gray-700">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: member?.color || "#d1d5db" }}
                        />
                        <span className="flex-1">{chore.name}</span>
                        <span className="text-xs text-gray-400">{FREQ_LABELS[chore.frequency] || chore.frequency}</span>
                        <span className="text-xs text-amber-500">{chore.star_value}⭐</span>
                        <button
                          onClick={() => deleteChore(chore.id)}
                          className="text-gray-300 hover:text-red-400 transition-colors ml-1"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                  {chores.length === 0 && <p className="text-xs text-gray-400 italic">No chores yet.</p>}
                </div>
              </div>

              {/* Reward management */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">Rewards</h3>
                  <button
                    onClick={() => setShowAddReward((v) => !v)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    + Add Reward
                  </button>
                </div>

                {showAddReward && (
                  <div className="bg-gray-50 rounded-xl p-3 space-y-2 mb-3">
                    <input
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      placeholder="Reward name (e.g. Movie night)"
                      value={rewardForm.name}
                      onChange={(e) => setRewardForm((f) => ({ ...f, name: e.target.value }))}
                    />
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500 w-20">Star cost:</label>
                      <input
                        type="number"
                        min={1}
                        className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        value={rewardForm.star_cost}
                        onChange={(e) => setRewardForm((f) => ({ ...f, star_cost: parseInt(e.target.value) || 1 }))}
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setShowAddReward(false)}
                        className="text-xs px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={addReward}
                        className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  {rewards.map((reward) => (
                    <div key={reward.id} className="flex items-center gap-2 py-1.5 text-sm text-gray-700">
                      <span className="flex-1">{reward.name}</span>
                      <span className="text-xs text-amber-500">{reward.star_cost}⭐</span>
                      <button
                        onClick={() => deleteReward(reward.id)}
                        className="text-gray-300 hover:text-red-400 transition-colors ml-1"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {rewards.length === 0 && <p className="text-xs text-gray-400 italic">No rewards yet.</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Redeem picker modal */}
      {redeemingReward && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">Redeem: {redeemingReward.name}</h3>
            <p className="text-sm text-gray-500">Cost: {redeemingReward.star_cost} ⭐ — Who is redeeming?</p>
            <div className="space-y-2">
              {visibleMembers.map((m) => {
                const canRedeem = getBalance(m.id) >= redeemingReward.star_cost;
                return (
                  <button
                    key={m.id}
                    disabled={!canRedeem}
                    onClick={() => redeemReward(redeemingReward, m.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors text-sm font-medium ${
                      canRedeem
                        ? "border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                        : "border-gray-100 text-gray-300 cursor-not-allowed"
                    }`}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ backgroundColor: m.color }}
                    >
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="flex-1 text-left">{m.name}</span>
                    <span className={`text-xs ${canRedeem ? "text-amber-500" : "text-gray-300"}`}>
                      {getBalance(m.id)} ⭐
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setRedeemingReward(null)}
              className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors pt-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
