"use client";

import { useState, useRef, useEffect } from "react";

// ─── Color math ───────────────────────────────────────

/** h: 0–360, s: 0–1, v: 0–1 → "#rrggbb" */
function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255);
  };
  const r = f(5), g = f(3), b = f(1);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function hexToHsv(hex: string): [number, number, number] {
  const c = hex.replace("#", "").padEnd(6, "0");
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, max > 0 ? d / max : 0, max];
}

function isValidHex(s: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(s);
}

// ─── Component ────────────────────────────────────────

export default function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState<[number, number, number]>(() =>
    hexToHsv(isValidHex(value) ? value : "#6366f1")
  );
  const [hexInput, setHexInput] = useState(value.toLowerCase());
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync when parent changes value
  useEffect(() => {
    if (isValidHex(value)) {
      setHsv(hexToHsv(value));
      setHexInput(value.toLowerCase());
    }
  }, [value]);

  // Close on outside click
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

  const liveHex = hsvToHex(...hsv);
  const hueOnlyHex = hsvToHex(hsv[0], 1, 1);

  /** Update internal state only (during drag) */
  const updateLive = (newHsv: [number, number, number]) => {
    setHsv(newHsv);
    setHexInput(hsvToHex(...newHsv).toLowerCase());
  };

  /** Update + fire onChange (on commit: pointer up, Enter, blur) */
  const commit = (newHsv: [number, number, number]) => {
    setHsv(newHsv);
    const hex = hsvToHex(...newHsv);
    setHexInput(hex.toLowerCase());
    onChange(hex);
  };

  // ── Saturation/Value square ──────────────────────────
  const handleSquare = (
    e: React.PointerEvent<HTMLDivElement>,
    isCommit: boolean
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    const next: [number, number, number] = [hsv[0], s, v];
    isCommit ? commit(next) : updateLive(next);
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* Trigger — colored circle with pencil badge */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="Change color"
        className="relative w-7 h-7 rounded-full flex-shrink-0 ring-2 ring-transparent hover:ring-gray-300 transition-all"
        style={{ backgroundColor: liveHex }}
      >
        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-sm pointer-events-none">
          <svg
            className="w-2.5 h-2.5 text-gray-500"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.232 5.232l3.536 3.536M9 11l6-6 3 3-6 6H9v-3z"
            />
          </svg>
        </span>
      </button>

      {/* Picker panel */}
      {open && (
        <div className="absolute left-0 top-9 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 w-56 select-none">
          {/* Saturation / Value square */}
          <div
            className="relative w-full rounded-lg overflow-hidden cursor-crosshair mb-2.5"
            style={{ height: 140, backgroundColor: hueOnlyHex }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              handleSquare(e, false);
            }}
            onPointerMove={(e) => {
              if (e.buttons !== 1) return;
              handleSquare(e, false);
            }}
            onPointerUp={(e) => handleSquare(e, true)}
          >
            {/* White → transparent (saturation) */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: "linear-gradient(to right, white, transparent)" }}
            />
            {/* Transparent → black (value) */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: "linear-gradient(to bottom, transparent, black)" }}
            />
            {/* Picker dot */}
            <div
              className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none"
              style={{
                left: `${hsv[1] * 100}%`,
                top: `${(1 - hsv[2]) * 100}%`,
                backgroundColor: liveHex,
                transform: "translate(-50%, -50%)",
              }}
            />
          </div>

          {/* Hue rainbow slider */}
          <div className="mb-3 px-0.5">
            <input
              type="range"
              min={0}
              max={359}
              value={Math.round(hsv[0])}
              onChange={(e) => updateLive([Number(e.target.value), hsv[1], hsv[2]])}
              onPointerUp={(e) =>
                commit([Number((e.target as HTMLInputElement).value), hsv[1], hsv[2]])
              }
              className="hue-slider w-full h-3 rounded-full cursor-pointer"
              style={{
                WebkitAppearance: "none",
                appearance: "none",
                background:
                  "linear-gradient(to right,#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)",
              }}
            />
          </div>

          {/* Hex input row */}
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex-shrink-0 border border-gray-100"
              style={{ backgroundColor: liveHex }}
            />
            <input
              type="text"
              value={hexInput}
              onChange={(e) => {
                const raw = e.target.value;
                setHexInput(raw);
                const normalized = raw.startsWith("#") ? raw : `#${raw}`;
                if (isValidHex(normalized)) {
                  const newHsv = hexToHsv(normalized);
                  setHsv(newHsv);
                  onChange(normalized);
                }
              }}
              onBlur={(e) => {
                const normalized = e.target.value.startsWith("#")
                  ? e.target.value
                  : `#${e.target.value}`;
                if (isValidHex(normalized)) {
                  onChange(normalized);
                } else {
                  // Reset to last valid
                  setHexInput(liveHex.toLowerCase());
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const normalized = hexInput.startsWith("#")
                    ? hexInput
                    : `#${hexInput}`;
                  if (isValidHex(normalized)) onChange(normalized);
                }
              }}
              className="flex-1 text-sm px-2 py-1.5 border border-gray-200 rounded-lg font-mono text-gray-900 focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
              placeholder="#000000"
              maxLength={7}
              spellCheck={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}
