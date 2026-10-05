"use client";

import React, { useState, useEffect, useId, useCallback } from "react";
import { DateInput } from "./date-input";
import { TimeInput } from "./time-input";
import {
  parseISOToDMY,
  parseDMYToISO,
  isValidDMY
} from "@/lib/date-utils";

export interface DateTimeInputProps {
  name?: string;
  value?: string;
  defaultValue?: string | Date | null;
  onChange?: (dmyTime: string, isoValue: string | null) => void;
  required?: boolean;
  disabled?: boolean;
  label?: string;
  error?: string;
  className?: string;
  locale?: string;
}

/**
 * Universal DateTime Input: Combines DD/MM/YYYY DateInput with 24-Hour HH:mm TimeInput.
 * Emits unified ISO string to Server Actions and displays DD/MM/YYYY clearly.
 */
export function DateTimeInput({
  name,
  value,
  defaultValue,
  onChange,
  required = false,
  disabled = false,
  label,
  error,
  className = "",
  locale = "ar"
}: DateTimeInputProps) {
  const isAr = locale === "ar";
  const uniqueId = useId();

  // Extract initial date and time
  const parseInitial = useCallback(() => {
    const raw = value || defaultValue;
    if (!raw) return { dateStr: "", timeStr: "00:00" };
    if (raw instanceof Date) {
      const dmy = parseISOToDMY(raw);
      const hours = String(raw.getHours()).padStart(2, "0");
      const minutes = String(raw.getMinutes()).padStart(2, "0");
      return { dateStr: dmy, timeStr: `${hours}:${minutes}` };
    }
    const str = String(raw).trim();
    if (str.includes("T")) {
      const [dPart, tPart] = str.split("T");
      return {
        dateStr: parseISOToDMY(dPart),
        timeStr: tPart ? tPart.slice(0, 5) : "00:00"
      };
    }
    if (str.includes(" ")) {
      const [dPart, tPart] = str.split(" ");
      return {
        dateStr: parseISOToDMY(dPart),
        timeStr: tPart ? tPart.slice(0, 5) : "00:00"
      };
    }
    return { dateStr: parseISOToDMY(str), timeStr: "00:00" };
  }, [value, defaultValue]);

  const initial = parseInitial();
  const [datePart, setDatePart] = useState(initial.dateStr);
  const [timePart, setTimePart] = useState(initial.timeStr);

  useEffect(() => {
    if (value !== undefined) {
      const parsed = parseInitial();
      setDatePart(parsed.dateStr);
      setTimePart(parsed.timeStr);
    }
  }, [value, parseInitial]);

  const computeIso = (dStr: string, tStr: string): string | null => {
    if (!isValidDMY(dStr)) return null;
    const isoDate = parseDMYToISO(dStr);
    const cleanTime = tStr && /^\d{2}:\d{2}$/.test(tStr) ? tStr : "00:00";
    return `${isoDate}T${cleanTime}:00`;
  };

  const handleDateChange = (newDate: string) => {
    setDatePart(newDate);
    const iso = computeIso(newDate, timePart);
    if (onChange) {
      onChange(`${newDate} ${timePart}`, iso);
    }
  };

  const handleTimeChange = (newTime: string) => {
    setTimePart(newTime);
    const iso = computeIso(datePart, newTime);
    if (onChange) {
      onChange(`${datePart} ${newTime}`, iso);
    }
  };

  const fullIso = computeIso(datePart, timePart) || "";

  return (
    <div className={`flex flex-col space-y-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={uniqueId}
          className="flex items-center justify-between text-xs font-semibold text-foreground"
        >
          <span>
            {label} {required && <span className="text-red-500">*</span>}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono font-normal">
            (DD/MM/YYYY • 24H)
          </span>
        </label>
      )}

      <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-12">
        {/* Give the time control enough width so its clock button never crowds the value. */}
        <div className="sm:col-span-7">
          <DateInput
            value={datePart}
            onChange={handleDateChange}
            required={required}
            disabled={disabled}
            locale={locale}
            placeholder="DD/MM/YYYY"
          />
        </div>

        {/* 24-Hour Time Input Part (5 cols) */}
        <div className="relative flex items-center sm:col-span-5" dir="ltr">
          <TimeInput
            id={uniqueId}
            value={timePart}
            onChange={handleTimeChange}
            disabled={disabled}
            required={required}
            locale={locale}
          />
        </div>
      </div>

      {/* Hidden input passing unified ISO datetime to forms */}
      {name && <input type="hidden" name={name} value={fullIso} />}

      {error && <p className="text-[11px] text-red-500 font-medium">{error}</p>}
    </div>
  );
}
