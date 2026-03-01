"use client";

import { useState, useEffect, useRef } from "react";
import { FamilyMember, FamilyCalendar, Photo, getMemberTextColor } from "@/lib/types";
import ColorPicker from "@/components/ColorPicker";

export default function SettingsPage() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [newMember, setNewMember] = useState("");
  const [adding, setAdding] = useState(false);
  const [icalUrls, setIcalUrls] = useState<Record<string, string>>({});
  const [icalSaved, setIcalSaved] = useState<Record<string, boolean>>({});
  const [icalSaving, setIcalSaving] = useState<Record<string, boolean>>({});

  // Family calendars state
  const [familyCalendars, setFamilyCalendars] = useState<FamilyCalendar[]>([]);
  const [calUrls, setCalUrls] = useState<Record<string, string>>({});
  const [calSaved, setCalSaved] = useState<Record<string, boolean>>({});
  const [calSaving, setCalSaving] = useState<Record<string, boolean>>({});
  const [showAddCal, setShowAddCal] = useState(false);
  const [newCalName, setNewCalName] = useState("");
  const [newCalColor, setNewCalColor] = useState("#6366F1");
  const [newCalUrl, setNewCalUrl] = useState("");
  const [addingCal, setAddingCal] = useState(false);

  // Photos state
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);

  const fetchMembers = async () => {
    const res = await fetch("/api/members");
    const data: FamilyMember[] = await res.json();
    setMembers(data);
    const urls: Record<string, string> = {};
    for (const m of data) urls[m.id] = m.ical_url || "";
    setIcalUrls(urls);
  };

  const fetchFamilyCalendars = async () => {
    const res = await fetch("/api/family-calendars");
    const data: FamilyCalendar[] = await res.json();
    setFamilyCalendars(data);
    const urls: Record<string, string> = {};
    for (const c of data) urls[c.id] = c.ical_url || "";
    setCalUrls(urls);
  };

  const fetchPhotos = async () => {
    const res = await fetch("/api/photos");
    const data: Photo[] = await res.json();
    setPhotos(data);
  };

  useEffect(() => { fetchMembers(); fetchFamilyCalendars(); fetchPhotos(); }, []);

  const handleAdd = async () => {
    const name = newMember.trim();
    if (!name) return;
    setAdding(true);
    await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setNewMember("");
    setAdding(false);
    fetchMembers();
  };

  const handleRemove = async (id: string, name: string) => {
    if (!confirm(`Remove ${name}?`)) return;
    await fetch("/api/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchMembers();
  };

  const handleChangeColor = async (memberId: string, color: string) => {
    await fetch("/api/members", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: memberId, color }),
    });
    fetchMembers();
  };

  const handleSaveIcalUrl = async (memberId: string) => {
    setIcalSaving((prev) => ({ ...prev, [memberId]: true }));
    const res = await fetch("/api/members", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: memberId, ical_url: icalUrls[memberId] || "" }),
    });
    setIcalSaving((prev) => ({ ...prev, [memberId]: false }));
    if (res.ok) {
      setIcalSaved((prev) => ({ ...prev, [memberId]: true }));
      setTimeout(() => setIcalSaved((prev) => ({ ...prev, [memberId]: false })), 2000);
    }
  };

  const isIcalDirty = (memberId: string) => {
    const member = members.find((m) => m.id === memberId);
    return (icalUrls[memberId] || "") !== (member?.ical_url || "");
  };

  const handleAddFamilyCalendar = async () => {
    const name = newCalName.trim();
    if (!name) return;
    setAddingCal(true);
    await fetch("/api/family-calendars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color: newCalColor }),
    });
    setNewCalName("");
    setNewCalColor("#6366F1");
    setNewCalUrl("");
    setShowAddCal(false);
    setAddingCal(false);
    fetchFamilyCalendars();
  };

  const handleSaveCalUrl = async (calId: string) => {
    setCalSaving((prev) => ({ ...prev, [calId]: true }));
    await fetch("/api/family-calendars", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: calId, ical_url: calUrls[calId] || "" }),
    });
    setCalSaving((prev) => ({ ...prev, [calId]: false }));
    setCalSaved((prev) => ({ ...prev, [calId]: true }));
    setTimeout(() => setCalSaved((prev) => ({ ...prev, [calId]: false })), 2000);
    fetchFamilyCalendars();
  };

  const handleChangeCalColor = async (calId: string, color: string) => {
    await fetch("/api/family-calendars", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: calId, color }),
    });
    fetchFamilyCalendars();
  };

  const handleDeleteFamilyCalendar = async (id: string, name: string) => {
    if (!confirm(`Remove "${name}"?`)) return;
    await fetch("/api/family-calendars", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchFamilyCalendars();
  };

  const handleToggleMemberHidden = async (id: string, currentlyHidden: boolean) => {
    await fetch("/api/members", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, hidden: !currentlyHidden }),
    });
    fetchMembers();
  };

  const handleToggleCalendarHidden = async (id: string, currentlyHidden: boolean) => {
    await fetch("/api/family-calendars", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, hidden: !currentlyHidden }),
    });
    fetchFamilyCalendars();
  };

  const isCalDirty = (calId: string) => {
    const cal = familyCalendars.find((c) => c.id === calId);
    return (calUrls[calId] || "") !== (cal?.ical_url || "");
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");
    const form = new FormData();
    form.append("file", file);
    setUploading(true);
    const res = await fetch("/api/photos", { method: "POST", body: form });
    setUploading(false);
    if (photoInputRef.current) photoInputRef.current.value = "";
    if (!res.ok) {
      let message = "Upload failed";
      try {
        const data = await res.json();
        message = data.error ?? message;
      } catch {}
      setUploadError(message);
    } else {
      fetchPhotos();
    }
  };

  const handleDeletePhoto = async (id: string) => {
    if (!confirm("Remove this photo?")) return;
    await fetch("/api/photos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchPhotos();
  };

  return (
    <div className="pb-4">
      <header className="border-b border-gray-100 px-4 md:px-8 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 md:px-8 py-6 space-y-6">
        {/* Family Members */}
        <section className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Family Members</h2>
          <p className="text-sm text-gray-400 mb-4">
            Members are used for event assignment and color coding.
          </p>

          {members.length === 0 ? (
            <p className="text-gray-500 text-sm mb-4">No family members added yet.</p>
          ) : (
            <div className="space-y-2 mb-4">
              {members.map((m) => {
                const textColor = getMemberTextColor(m.color);
                return (
                  <div key={m.id} className="rounded-xl" style={{ backgroundColor: `${m.color}30` }}>
                    <div className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-3">
                        <ColorPicker
                          value={m.color}
                          onChange={(color) => handleChangeColor(m.id, color)}
                        />
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                          style={{ backgroundColor: m.color, color: textColor }}
                        >
                          {m.name[0].toUpperCase()}
                        </div>
                        <p className="font-medium text-gray-900">{m.name}</p>
                      </div>
                      <button onClick={() => handleRemove(m.id, m.name)}
                        className="text-gray-400 hover:text-red-500 p-1">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-2">
            <input type="text" value={newMember} onChange={(e) => setNewMember(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 text-gray-900"
              placeholder="Add family member" />
            <button onClick={handleAdd} disabled={adding || !newMember.trim()}
              className="px-4 py-2 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 font-medium disabled:opacity-50 text-sm">
              {adding ? "Adding..." : "Add"}
            </button>
          </div>
        </section>

        {/* Google Calendar Integration */}
        {members.length > 0 && (
          <section className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Google Calendar Integration</h2>
            <p className="text-sm text-gray-400 mb-4">
              Paste each member&apos;s Google Calendar iCal URL to show their events on the calendar (read-only).
            </p>

            <div className="space-y-4 mb-4">
              {members.map((m) => {
                const textColor = getMemberTextColor(m.color);
                const isHidden = Boolean(m.hidden);
                return (
                  <div key={m.id}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                          style={{ backgroundColor: m.color, color: textColor }}>
                          {m.name[0].toUpperCase()}
                        </div>
                        {m.name}
                      </label>
                      <button
                        onClick={() => handleToggleMemberHidden(m.id, isHidden)}
                        title={isHidden ? "Show on calendar" : "Hide from calendar"}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors ${
                          isHidden
                            ? "bg-gray-100 text-gray-400 hover:bg-gray-200"
                            : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                        }`}
                      >
                        {isHidden ? <EyeOffIcon /> : <EyeIcon />}
                        {isHidden ? "Hidden" : "Visible"}
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={icalUrls[m.id] || ""}
                        onChange={(e) => {
                          setIcalUrls((prev) => ({ ...prev, [m.id]: e.target.value }));
                          setIcalSaved((prev) => ({ ...prev, [m.id]: false }));
                        }}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 text-gray-900 text-sm"
                        placeholder="https://calendar.google.com/calendar/ical/..."
                      />
                      <button
                        onClick={() => handleSaveIcalUrl(m.id)}
                        disabled={!isIcalDirty(m.id) || icalSaving[m.id]}
                        className="px-3 py-2 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 font-medium disabled:opacity-50 text-sm whitespace-nowrap"
                      >
                        {icalSaving[m.id] ? "Saving..." : icalSaved[m.id] ? "Saved!" : "Save"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <details className="text-sm text-gray-500">
              <summary className="cursor-pointer font-medium text-gray-600 hover:text-gray-800">
                How to find your Google Calendar iCal URL
              </summary>
              <ol className="mt-2 ml-4 space-y-1 list-decimal">
                <li>Open <strong>Google Calendar</strong> on the web</li>
                <li>Click the gear icon and select <strong>Settings</strong></li>
                <li>Under &quot;Settings for my calendars&quot;, click the calendar you want to share</li>
                <li>Scroll to <strong>&quot;Integrate calendar&quot;</strong></li>
                <li>Copy the <strong>&quot;Secret address in iCal format&quot;</strong> URL</li>
                <li>Paste it above for the matching family member</li>
              </ol>
            </details>
          </section>
        )}

        {/* Family Calendars */}
        <section className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Family Calendars</h2>
          <p className="text-sm text-gray-400 mb-4">
            Shared calendars for the whole family (school events, sports, holidays, etc.)
          </p>

          {familyCalendars.length > 0 && (
            <div className="space-y-4 mb-4">
              {familyCalendars.map((cal) => {
                const isHidden = Boolean(cal.hidden);
                return (
                <div key={cal.id} className="rounded-xl border border-gray-100">
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <ColorPicker
                        value={cal.color}
                        onChange={(color) => handleChangeCalColor(cal.id, color)}
                      />
                      <span className="text-sm font-medium text-gray-700">{cal.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleCalendarHidden(cal.id, isHidden)}
                        title={isHidden ? "Show on calendar" : "Hide from calendar"}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors ${
                          isHidden
                            ? "bg-gray-100 text-gray-400 hover:bg-gray-200"
                            : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                        }`}
                      >
                        {isHidden ? <EyeOffIcon /> : <EyeIcon />}
                        {isHidden ? "Hidden" : "Visible"}
                      </button>
                      <button
                        onClick={() => handleDeleteFamilyCalendar(cal.id, cal.name)}
                        className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                        title="Remove calendar"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2 px-3 pb-3">
                    <input
                      type="url"
                      value={calUrls[cal.id] || ""}
                      onChange={(e) => {
                        setCalUrls((prev) => ({ ...prev, [cal.id]: e.target.value }));
                        setCalSaved((prev) => ({ ...prev, [cal.id]: false }));
                      }}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 text-gray-900 text-sm"
                      placeholder="https://calendar.google.com/calendar/ical/..."
                    />
                    <button
                      onClick={() => handleSaveCalUrl(cal.id)}
                      disabled={!isCalDirty(cal.id) || calSaving[cal.id]}
                      className="px-3 py-2 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 font-medium disabled:opacity-50 text-sm whitespace-nowrap"
                    >
                      {calSaving[cal.id] ? "Saving..." : calSaved[cal.id] ? "Saved!" : "Save"}
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          )}

          {showAddCal ? (
            <div className="space-y-3 pt-3 border-t border-gray-100">
              <input
                type="text"
                value={newCalName}
                onChange={(e) => setNewCalName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 text-gray-900 text-sm"
                placeholder="Calendar name (e.g. School, Sports)"
              />
              <div className="flex items-center gap-3">
                <p className="text-xs text-gray-500">Color</p>
                <ColorPicker value={newCalColor} onChange={setNewCalColor} />
                <span className="text-sm font-mono text-gray-500">{newCalColor}</span>
              </div>
              <input
                type="url"
                value={newCalUrl}
                onChange={(e) => setNewCalUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 text-gray-900 text-sm"
                placeholder="https://calendar.google.com/calendar/ical/... (optional, add later)"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddFamilyCalendar}
                  disabled={addingCal || !newCalName.trim()}
                  className="px-4 py-2 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 font-medium disabled:opacity-50 text-sm"
                >
                  {addingCal ? "Adding..." : "Add Calendar"}
                </button>
                <button
                  onClick={() => { setShowAddCal(false); setNewCalName(""); setNewCalUrl(""); }}
                  className="px-4 py-2 text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-100 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddCal(true)}
              className="flex items-center gap-1.5 text-sm text-indigo-500 hover:text-indigo-700 font-medium py-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Family Calendar
            </button>
          )}
        </section>

        {/* Color Legend */}
        <section className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Color Legend</h2>
          <div className="flex flex-wrap gap-3">
            {members.map((m) => {
              const textColor = getMemberTextColor(m.color);
              return (
                <div key={m.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: m.color }}>
                  <span className="text-sm font-medium" style={{ color: textColor }}>{m.name}</span>
                </div>
              );
            })}
          </div>
          {members.length === 0 && (
            <p className="text-sm text-gray-400">Add family members to see their colors.</p>
          )}
        </section>

        {/* Photos */}
        <section className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-semibold text-gray-900">Photos</h2>
            <span className="text-sm text-gray-400">{photos.length} of 10</span>
          </div>
          <p className="text-sm text-gray-400 mb-4">
            Upload up to 10 family photos for the Photos slideshow.
          </p>

          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              {photos.map((photo) => (
                <div key={photo.id} className="relative group aspect-square">
                  <img
                    src={`/api/photos/${photo.id}`}
                    alt={photo.original_name}
                    className="w-full h-full object-cover rounded-xl"
                  />
                  <button
                    onClick={() => handleDeletePhoto(photo.id)}
                    className="absolute top-1 right-1 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity text-sm leading-none hover:bg-black/80"
                    title="Remove photo"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {uploadError && (
            <p className="text-red-500 text-sm mb-3">{uploadError}</p>
          )}

          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoUpload}
          />
          <button
            onClick={() => { setUploadError(""); photoInputRef.current?.click(); }}
            disabled={uploading || photos.length >= 10}
            title={photos.length >= 10 ? "Maximum 10 photos reached" : undefined}
            className="flex items-center gap-1.5 text-sm text-indigo-500 hover:text-indigo-700 font-medium py-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {uploading ? "Uploading..." : "Add Photo"}
          </button>
        </section>

        {/* iPad Kiosk Setup */}
        <section className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">iPad Kiosk Setup</h2>
          <p className="text-sm text-gray-400 mb-4">
            Keep the calendar always visible on an iPad, fullscreen with no browser chrome.
          </p>

          <div className="space-y-5 text-sm text-gray-700">
            <div>
              <p className="font-semibold text-gray-900 mb-1.5">Step 1 — Add to Home Screen</p>
              <p className="text-gray-500 mb-2">This removes the URL bar and tabs so the app fills the screen like a native app.</p>
              <ol className="ml-4 space-y-1 list-decimal text-gray-600">
                <li>Open Safari and navigate to this site</li>
                <li>Tap the <strong>Share</strong> button (box with arrow pointing up) in the toolbar</li>
                <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
                <li>Name it (e.g. &ldquo;Family Calendar&rdquo;) and tap <strong>Add</strong></li>
                <li>Close Safari and open the app from the Home Screen — it will launch fullscreen with no browser chrome</li>
              </ol>
            </div>

            <div>
              <p className="font-semibold text-gray-900 mb-1.5">Step 2 — Enable Guided Access</p>
              <p className="text-gray-500 mb-2">Guided Access locks the iPad to one app so nothing can be accidentally opened.</p>
              <ol className="ml-4 space-y-1 list-decimal text-gray-600">
                <li>Go to <strong>Settings → Accessibility → Guided Access</strong></li>
                <li>Toggle <strong>Guided Access</strong> on</li>
                <li>Tap <strong>Passcode Settings</strong> and set a passcode (this is how you exit kiosk mode later)</li>
              </ol>
            </div>

            <div>
              <p className="font-semibold text-gray-900 mb-1.5">Step 3 — Start a Guided Access Session</p>
              <ol className="ml-4 space-y-1 list-decimal text-gray-600">
                <li>Open the Family Calendar app from the Home Screen</li>
                <li><strong>Triple-click the Home button</strong> (or the Side button on iPads without a Home button)</li>
                <li>Tap <strong>Start</strong> in the Guided Access screen</li>
                <li>The iPad is now locked to the calendar — nothing else can be opened</li>
              </ol>
              <p className="mt-2 text-gray-400">To exit: triple-click the Home/Side button, enter your passcode, then tap <strong>End</strong>.</p>
            </div>
          </div>
        </section>

        {/* About */}
        <section className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">About</h2>
          <p className="text-sm text-gray-500">
            Family Calendar &mdash; a Skylight-inspired calendar for your family.
            Data is stored locally on this device.
          </p>
        </section>
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}
