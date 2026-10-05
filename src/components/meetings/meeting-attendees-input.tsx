"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface MeetingAttendeesInputProps {
  name?: string;
  id?: string;
  initialValue?: string[];
  placeholder: string;
  locale?: string;
  disabled?: boolean;
}

export function MeetingAttendeesInput({
  name = "attendees",
  id = "meeting-attendees",
  initialValue = [],
  placeholder,
  locale = "ar",
  disabled = false
}: MeetingAttendeesInputProps) {
  const [attendees, setAttendees] = useState(() => initialValue.map((name) => name.trim()).filter(Boolean));
  const [draft, setDraft] = useState("");
  const isArabic = locale === "ar";

  const addDraft = () => {
    const names = draft.split(/[,،]/).map((name) => name.trim()).filter(Boolean);
    if (!names.length) return;
    setAttendees((current) => {
      const known = new Set(current.map((name) => name.toLocaleLowerCase()));
      return [...current, ...names.filter((name) => {
        const key = name.toLocaleLowerCase();
        if (known.has(key)) return false;
        known.add(key);
        return true;
      })];
    });
    setDraft("");
  };

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      className={`flex min-h-12 w-full flex-wrap items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 transition-colors focus-within:border-club-primary focus-within:ring-2 focus-within:ring-club-primary/15 ${disabled ? "opacity-60" : ""}`}
    >
      <input type="hidden" name={name} value={attendees.join(", ")} />
      {attendees.map((attendee, index) => (
        <span
          key={`${attendee}-${index}`}
          className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-club-primary/25 bg-club-primary/10 px-2.5 py-1 text-xs font-semibold text-club-primary"
        >
          <span className="max-w-56 truncate">{attendee}</span>
          {!disabled && (
            <button
              type="button"
              onClick={() => setAttendees((current) => current.filter((_, itemIndex) => itemIndex !== index))}
              aria-label={isArabic ? `حذف ${attendee} من الحضور` : `Retirer ${attendee} des participants`}
              title={isArabic ? "حذف الاسم" : "Supprimer le nom"}
              className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-club-primary/75 transition-colors hover:bg-club-primary/15 hover:text-club-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-primary/40"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          id={id}
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addDraft();
            } else if (event.key === "Backspace" && !draft && attendees.length > 0) {
              setAttendees((current) => current.slice(0, -1));
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          className="min-w-36 flex-1 border-0 bg-transparent px-1 py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-0"
        />
      )}
    </div>
  );
}
