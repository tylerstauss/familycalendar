"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CryptoPendingPage() {
  const router = useRouter();

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch("/api/subscribe/status");
        if (!res.ok) return;
        const sub = await res.json();
        if (sub?.status === "active") {
          clearInterval(poll);
          router.replace("/");
        }
      } catch {
        // ignore
      }
    }, 5000);
    return () => clearInterval(poll);
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-100 p-8 text-center">
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">◈</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Waiting for confirmation</h1>
        <p className="text-gray-500 mb-6">
          We&apos;re waiting for your crypto payment to confirm on the blockchain.
          This usually takes 1–3 minutes.
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
          <div className="w-4 h-4 rounded-full border-2 border-blue-300 border-t-blue-500 animate-spin" />
          Checking for confirmation…
        </div>
        <p className="mt-6 text-xs text-gray-400">
          You can close this page — we&apos;ll activate your account as soon as payment confirms.
          Return to{" "}
          <a href="/subscribe" className="text-indigo-500 hover:text-indigo-700">
            the subscribe page
          </a>{" "}
          to check your status.
        </p>
      </div>
    </div>
  );
}
