"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface Subscription {
  status: string;
  plan: string | null;
  payment_method: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
}

function trialDaysLeft(trialEndsAt: string | null): number {
  if (!trialEndsAt) return 0;
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export default function SubscribePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isWelcome = searchParams.get("welcome") === "1";
  const [sub, setSub] = useState<Subscription | null | undefined>(undefined);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/subscribe/status")
      .then((r) => (r.ok ? r.json() : null))
      .then(setSub)
      .catch(() => setSub(null));
  }, []);

  const handleStripe = async (plan: "monthly" | "annual") => {
    setError(null);
    setLoading(`stripe-${plan}`);
    try {
      const res = await fetch("/api/subscribe/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setError(data.error ?? "Failed to create checkout session");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const handleCoinbase = async (plan: "monthly" | "annual") => {
    setError(null);
    setLoading(`coinbase-${plan}`);
    try {
      const res = await fetch("/api/subscribe/coinbase/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setError(data.error ?? "Failed to create crypto charge");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setLoading("portal");
    try {
      const res = await fetch("/api/subscribe/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setError(data.error ?? "Failed to open billing portal");
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(null);
    }
  };

  // Show loading skeleton while fetching
  if (sub === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-indigo-200 border-t-indigo-500 animate-spin" />
      </div>
    );
  }

  const isActive = sub?.status === "active";
  const isComped = sub?.status === "comped";
  const isTrialing = sub?.status === "trialing";
  const daysLeft = isTrialing ? trialDaysLeft(sub?.trial_ends_at ?? null) : 0;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <Link href="/calendar" className="text-sm text-indigo-500 hover:text-indigo-700 font-medium mb-4 inline-block">
            ← Back to Calendar
          </Link>
          {isWelcome ? (
            <>
              <h1 className="text-3xl font-bold text-gray-900 mt-2">One last step</h1>
              <p className="text-gray-500 mt-2">Add a payment method to start your 7-day free trial. You won&apos;t be charged until day 8.</p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-gray-900 mt-2">Family Calendar Plans</h1>
              <p className="text-gray-500 mt-2">All features included. One price for the whole family.</p>
            </>
          )}
          {isTrialing && daysLeft > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-xl text-sm font-medium">
              <span>⏳</span>
              <span>{daysLeft} day{daysLeft !== 1 ? "s" : ""} left in your free trial</span>
            </div>
          )}
          {!isWelcome && !isTrialing && !isActive && !isComped && (
            <div className="mt-4 inline-flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-xl text-sm font-medium">
              <span>⚠️</span>
              <span>Your trial has expired. Subscribe to continue.</span>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Current plan banner */}
        {(isActive || isComped) && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <p className="font-semibold text-green-800">
                {isComped
                  ? "Complimentary access"
                  : `${sub?.plan === "annual" ? "Annual" : "Monthly"} plan — Active`}
              </p>
            </div>
            {!isComped && sub?.current_period_end && (
              <p className="text-sm text-green-700">
                Renews {formatDate(sub.current_period_end)}
              </p>
            )}
            {isActive && sub?.payment_method === "stripe" && (
              <button
                onClick={handleManageBilling}
                disabled={loading === "portal"}
                className="mt-3 text-sm text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
              >
                {loading === "portal" ? "Opening…" : "Manage Billing →"}
              </button>
            )}
          </div>
        )}

        {/* Pricing cards */}
        {!isComped && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Monthly */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col">
              <h2 className="text-lg font-semibold text-gray-900">Monthly</h2>
              <div className="mt-2 mb-4">
                <span className="text-3xl font-bold text-gray-900">$4.99</span>
                <span className="text-gray-400 text-sm">/month</span>
              </div>
              <p className="text-sm text-gray-500 mb-6 flex-1">
                Full access for your whole family, billed monthly. Cancel anytime.
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => handleStripe("monthly")}
                  disabled={!!loading}
                  className="w-full py-2.5 px-4 bg-indigo-500 text-white rounded-xl font-medium text-sm hover:bg-indigo-600 disabled:opacity-50 transition-colors"
                >
                  {loading === "stripe-monthly" ? "Loading…" : "Start 7-day free trial"}
                </button>
                <button
                  onClick={() => handleCoinbase("monthly")}
                  disabled={!!loading}
                  className="w-full py-2.5 px-4 border border-gray-200 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {loading === "coinbase-monthly" ? (
                    "Loading…"
                  ) : (
                    <>
                      <span className="text-blue-500">◈</span>
                      Pay with Crypto (USDC)
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Annual */}
            <div className="bg-white rounded-2xl border-2 border-indigo-400 p-6 flex flex-col relative">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                BEST VALUE
              </span>
              <h2 className="text-lg font-semibold text-gray-900">Annual</h2>
              <div className="mt-2 mb-1">
                <span className="text-3xl font-bold text-gray-900">$49.99</span>
                <span className="text-gray-400 text-sm">/year</span>
              </div>
              <p className="text-sm text-emerald-600 font-medium mb-4">Save ~17% vs monthly</p>
              <p className="text-sm text-gray-500 mb-6 flex-1">
                Full access for your whole family, billed annually.
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => handleStripe("annual")}
                  disabled={!!loading}
                  className="w-full py-2.5 px-4 bg-indigo-500 text-white rounded-xl font-medium text-sm hover:bg-indigo-600 disabled:opacity-50 transition-colors"
                >
                  {loading === "stripe-annual" ? "Loading…" : "Start 7-day free trial"}
                </button>
                <button
                  onClick={() => handleCoinbase("annual")}
                  disabled={!!loading}
                  className="w-full py-2.5 px-4 border border-gray-200 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {loading === "coinbase-annual" ? (
                    "Loading…"
                  ) : (
                    <>
                      <span className="text-blue-500">◈</span>
                      Pay with Crypto (USDC)
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Features list */}
        <div className="mt-8 bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Everything included</h3>
          <ul className="space-y-2">
            {[
              "Family calendar with shared events",
              "Google Calendar sync (read + write)",
              "Apple Calendar / iCal subscription",
              "Rides planning with drive-time estimates",
              "Chores & rewards tracker",
              "Meal planning & grocery lists",
              "Family photos slideshow",
              "Unlimited family members",
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-gray-600">
                <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
