"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Photo } from "@/lib/types";

export default function PhotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [loaded, setLoaded] = useState(false);
  // Incrementing this resets the 15-second auto-advance timer
  const [timerKey, setTimerKey] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    fetch("/api/photos")
      .then((r) => r.json())
      .then((data) => {
        setPhotos(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  // Auto-advance — resets whenever timerKey changes (manual navigation)
  useEffect(() => {
    if (photos.length <= 1) return;
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % photos.length);
        setVisible(true);
      }, 400);
    }, 15000);
    return () => clearInterval(timer);
  }, [photos.length, timerKey]);

  const navigate = useCallback(
    (dir: 1 | -1) => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + dir + photos.length) % photos.length);
        setVisible(true);
      }, 400);
      setTimerKey((k) => k + 1);
    },
    [photos.length]
  );

  // Keyboard arrow keys
  useEffect(() => {
    if (photos.length <= 1) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") navigate(-1);
      if (e.key === "ArrowRight") navigate(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [photos.length, navigate]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || photos.length <= 1) return;
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 50) {
      navigate(delta > 0 ? 1 : -1);
    }
    touchStartX.current = null;
  };

  if (!loaded) {
    return <div className="fixed inset-0 bg-black" />;
  }

  if (photos.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-4 z-50">
        <p className="text-white text-lg font-medium">No photos yet</p>
        <p className="text-gray-400 text-sm">Add some in Settings</p>
        <Link
          href="/settings"
          className="mt-2 px-5 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-medium hover:bg-indigo-600 transition-colors"
        >
          Go to Settings
        </Link>
      </div>
    );
  }

  const currentPhoto = photos[index];

  return (
    <div
      className="fixed inset-0 bg-black z-50 flex items-center justify-center"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Photo */}
      <img
        key={currentPhoto.id}
        src={`/api/photos/${currentPhoto.id}`}
        alt={currentPhoto.original_name}
        style={{
          opacity: visible ? 1 : 0,
          transition: "opacity 0.8s ease-in-out",
          objectFit: "contain",
          width: "100%",
          height: "100%",
        }}
      />

      {/* Arrow buttons — only shown when there are multiple photos */}
      {photos.length > 1 && (
        <>
          <button
            onClick={() => navigate(-1)}
            aria-label="Previous photo"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-black/40 text-white opacity-40 hover:opacity-100 transition-opacity"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button
            onClick={() => navigate(1)}
            aria-label="Next photo"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-black/40 text-white opacity-40 hover:opacity-100 transition-opacity"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </>
      )}

      {/* Dot indicators */}
      {photos.length > 1 && (
        <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2">
          {photos.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === index ? "bg-white" : "bg-white/30"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
