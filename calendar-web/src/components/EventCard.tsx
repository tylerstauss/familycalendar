"use client";

import { CalendarEvent, FamilyMember, getMemberTextColor } from "@/lib/types";
import { format } from "date-fns";

interface EventCardProps {
  event: CalendarEvent;
  members: FamilyMember[];
  onEdit?: () => void;
  onDelete?: () => void;
  compact?: boolean;
}

export default function EventCard({ event, members, onEdit, onDelete, compact }: EventCardProps) {
  const assignedMembers = members.filter((m) => event.assignee_ids.includes(m.id));
  const primaryColor = assignedMembers[0]?.color || "#E5E7EB";
  const primaryTextColor = assignedMembers[0] ? getMemberTextColor(assignedMembers[0].color) : "#374151";
  const startTime = new Date(event.start_time);
  const endTime = new Date(event.end_time);

  const isIcal = event.source === "ical";
  const isMeal = event.source === "meal";
  const isReadOnly = isIcal || isMeal;

  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 px-2 py-1 rounded-xl text-sm ${isIcal ? "opacity-70" : ""}`}
        style={{ backgroundColor: primaryColor }}
      >
        <span className="font-medium truncate" style={{ color: primaryTextColor }}>
          {isIcal && <span className="mr-1">&#128279;</span>}
          {isMeal && <span className="mr-1">&#127869;</span>}
          {event.title}
        </span>
        <span className="text-xs ml-auto shrink-0 opacity-80" style={{ color: primaryTextColor }}>
          {format(startTime, "h:mm a")}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow ${isIcal ? "opacity-75" : ""}`}
      style={{ backgroundColor: primaryColor }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg truncate" style={{ color: primaryTextColor }}>
            {isIcal && <span className="mr-1" title="Google Calendar">&#128279;</span>}
            {isMeal && <span className="mr-1" title="Meal Plan">&#127869;</span>}
            {event.title}
          </h3>
          <p className="text-sm mt-0.5 opacity-80" style={{ color: primaryTextColor }}>
            {format(startTime, "h:mm a")} &ndash; {format(endTime, "h:mm a")}
          </p>
          {event.location && (
            <p className="text-sm mt-1 opacity-70" style={{ color: primaryTextColor }}>{event.location}</p>
          )}
        </div>
        {!isReadOnly && (onEdit || onDelete) && (
          <div className="flex gap-1 ml-2">
            {onEdit && (
              <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-black/10 transition-colors" style={{ color: primaryTextColor }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
            {onDelete && (
              <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-black/10 transition-colors" style={{ color: primaryTextColor }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
      {assignedMembers.length > 0 && (
        <div className="flex items-center gap-1.5 mt-3">
          {assignedMembers.map((m) => {
            const memberText = getMemberTextColor(m.color);
            return (
              <span
                key={m.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: `${memberText}15`, color: memberText }}
              >
                {m.name}
              </span>
            );
          })}
        </div>
      )}
      {event.notes && (
        <p className="text-sm mt-2 line-clamp-2 opacity-70" style={{ color: primaryTextColor }}>{event.notes}</p>
      )}
    </div>
  );
}
