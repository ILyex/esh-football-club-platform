"use client";

import React, { useState, useEffect, useRef, useId } from "react";
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle
} from "lucide-react";
import {
  isValidDMY,
  formatDateToDMY,
  parseDMYToISO,
  parseISOToDMY,
  getDaysInMonth
} from "@/lib/date-utils";

export interface DateInputProps {
  name?: string;
  value?: string;
  defaultValue?: string | Date | null;
  onChange?: (value: string, isoValue: string | null) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  label?: string;
  error?: string;
  className?: string;
  inputClassName?: string;
  minDate?: string | Date;
  maxDate?: string | Date;
  helperText?: string;
  showCalendar?: boolean;
  dir?: "ltr" | "rtl";
  locale?: string;
}

const MONTH_NAMES_AR = [
  "جانفي (01)",
  "فيفري (02)",
  "مارس (03)",
  "أفريل (04)",
  "ماي (05)",
  "جوان (06)",
  "جويلية (07)",
  "أوت (08)",
  "سبتمبر (09)",
  "أكتوبر (10)",
  "نوفمبر (11)",
  "ديسمبر (12)"
];

const MONTH_NAMES_FR = [
  "Janvier (01)",
  "Février (02)",
  "Mars (03)",
  "Avril (04)",
  "Mai (05)",
  "Juin (06)",
  "Juillet (07)",
  "Août (08)",
  "Septembre (09)",
  "Octobre (10)",
  "Novembre (11)",
  "Décembre (12)"
];

const WEEKDAY_NAMES_AR = ["سبت", "أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة"];
const WEEKDAY_NAMES_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

/**
 * Universal Mandatory Date Input Component for ESH Platform.
 * Enforces DD/MM/YYYY formatting, validation, and calendar selection.
 */
export function DateInput({
  name,
  value,
  defaultValue,
  onChange,
  onBlur,
  placeholder = "DD/MM/YYYY",
  required = false,
  disabled = false,
  label,
  error,
  className = "",
  inputClassName = "",
  helperText,
  showCalendar = true,
  locale = "ar"
}: DateInputProps) {
  const isControlled = value !== undefined;
  const isAr = locale === "ar";
  const uniqueId = useId();

  // Normalize initial value to DD/MM/YYYY
  const getInitialValue = (): string => {
    if (value) return parseISOToDMY(value);
    if (defaultValue) return parseISOToDMY(defaultValue);
    return "";
  };

  const [displayValue, setDisplayValue] = useState<string>(getInitialValue);
  const [isOpen, setIsOpen] = useState(false);
  const [openDateMenu, setOpenDateMenu] = useState<"month" | "year" | null>(null);
  const [calendarMonth, setCalendarMonth] = useState<number>(() => {
    const init = getInitialValue();
    if (isValidDMY(init)) {
      const parts = init.split("/");
      return parseInt(parts[1]!, 10) - 1;
    }
    return new Date().getMonth();
  });
  const [calendarYear, setCalendarYear] = useState<number>(() => {
    const init = getInitialValue();
    if (isValidDMY(init)) {
      const parts = init.split("/");
      return parseInt(parts[2]!, 10);
    }
    return new Date().getFullYear();
  });

  const popoverRef = useRef<HTMLDivElement>(null);
  const monthYearRef = useRef<HTMLDivElement>(null);
  const dateMenuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!openDateMenu) return;
    dateMenuRef.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [openDateMenu]);

  // Sync when controlled value changes
  useEffect(() => {
    if (isControlled && value !== undefined) {
      const formatted = parseISOToDMY(value);
      setDisplayValue(formatted);
      if (isValidDMY(formatted)) {
        const parts = formatted.split("/");
        setCalendarMonth(parseInt(parts[1]!, 10) - 1);
        setCalendarYear(parseInt(parts[2]!, 10));
      }
    }
  }, [isControlled, value]);

  // Close calendar popover on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setOpenDateMenu(null);
        return;
      }
      if (monthYearRef.current && !monthYearRef.current.contains(event.target as Node)) setOpenDateMenu(null);
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (openDateMenu) setOpenDateMenu(null);
      else setIsOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, openDateMenu]);

  // Masked typing: auto-insert slashes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value;

    // Always rebuild the mask from the digits. Previously, once the first
    // slash existed, the handler stopped formatting, so the second slash was
    // never inserted when users typed the month and year manually.
    const digitsOnly = input.replace(/\D/g, "").slice(0, 8);
    const endsWithSlash = /\/$/.test(input);
    let cleaned = digitsOnly;

    if (digitsOnly.length > 2) {
      cleaned = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}`;
    } else if (endsWithSlash && digitsOnly.length === 2) {
      cleaned = `${digitsOnly}/`;
    }

    if (digitsOnly.length > 4) {
      cleaned += `/${digitsOnly.slice(4)}`;
    } else if (endsWithSlash && digitsOnly.length === 4) {
      cleaned += "/";
    }

    setDisplayValue(cleaned);

    const valid = isValidDMY(cleaned);
    const isoVal = valid ? parseDMYToISO(cleaned) : null;

    if (valid) {
      const parts = cleaned.split("/");
      setCalendarMonth(parseInt(parts[1]!, 10) - 1);
      setCalendarYear(parseInt(parts[2]!, 10));
    }

    if (onChange) {
      onChange(cleaned, isoVal);
    }
  };

  // Day click from calendar
  const handleSelectDay = (day: number) => {
    const formattedDay = String(day).padStart(2, "0");
    const formattedMonth = String(calendarMonth + 1).padStart(2, "0");
    const formattedDate = `${formattedDay}/${formattedMonth}/${calendarYear}`;

    setDisplayValue(formattedDate);
    setIsOpen(false);

    const isoVal = parseDMYToISO(formattedDate);
    if (onChange) {
      onChange(formattedDate, isoVal);
    }
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Quick Select: Today
  const handleSelectToday = () => {
    const today = new Date();
    const formatted = formatDateToDMY(today);
    setDisplayValue(formatted);
    setCalendarMonth(today.getMonth());
    setCalendarYear(today.getFullYear());
    setIsOpen(false);

    const isoVal = parseDMYToISO(formatted);
    if (onChange) {
      onChange(formatted, isoVal);
    }
  };

  // Clear value
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDisplayValue("");
    if (onChange) {
      onChange("", null);
    }
  };

  const isoValue = isValidDMY(displayValue) ? parseDMYToISO(displayValue) : "";
  const isInvalid = displayValue.length >= 8 && !isValidDMY(displayValue);

  // Month navigation
  const prevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenDateMenu(null);
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear((y) => y - 1);
    } else {
      setCalendarMonth((m) => m - 1);
    }
  };

  const nextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenDateMenu(null);
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear((y) => y + 1);
    } else {
      setCalendarMonth((m) => m + 1);
    }
  };

  // Calendar Days calculation
  const daysInCurrentMonth = getDaysInMonth(calendarMonth + 1, calendarYear);
  const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay(); // 0 is Sunday, 6 is Saturday

  // Year options list for fast jumping (e.g. 1940 to 2035)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 100 }, (_, i) => currentYear + 5 - i);

  const monthMenu = (menu: "month" | "year") => {
    const isMonth = menu === "month";
    const selectedValue = isMonth ? calendarMonth : calendarYear;
    const options = isMonth
      ? (isAr ? MONTH_NAMES_AR : MONTH_NAMES_FR).map((label, index) => ({ value: index, label }))
      : yearOptions.map((year) => ({ value: year, label: String(year) }));

    return (
      <div className="relative">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={openDateMenu === menu}
          aria-controls={`date-${menu}-${uniqueId}`}
          aria-label={isMonth ? (isAr ? "اختيار الشهر" : "Choisir le mois") : (isAr ? "اختيار السنة" : "Choisir l’année")}
          onClick={() => setOpenDateMenu((current) => current === menu ? null : menu)}
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2 text-xs font-bold text-foreground shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-primary/30 ${
            openDateMenu === menu
              ? "border-club-primary bg-club-primary/10 text-club-primary"
              : "border-border bg-background hover:border-club-primary/50 hover:bg-muted"
          }`}
        >
          <span>{options.find((option) => option.value === selectedValue)?.label}</span>
          <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${openDateMenu === menu ? "rotate-180" : ""}`} />
        </button>
        {openDateMenu === menu && (
          <div
            ref={dateMenuRef}
            id={`date-${menu}-${uniqueId}`}
            role="listbox"
            aria-label={isMonth ? (isAr ? "الشهر" : "Mois") : (isAr ? "السنة" : "Année")}
            className={`absolute ${isAr ? "end-0" : "start-0"} top-full z-[60] mt-1 max-h-56 overflow-y-auto overscroll-contain rounded-xl border border-border bg-card p-1 text-foreground shadow-xl ring-1 ring-black/5 ${
              isMonth ? "min-w-36" : "min-w-24"
            }`}
          >
            {options.map((option) => {
              const selected = option.value === selectedValue;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    if (isMonth) setCalendarMonth(option.value);
                    else setCalendarYear(option.value);
                    setOpenDateMenu(null);
                  }}
                  className={`flex min-h-8 w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-start text-xs transition-colors ${
                    selected
                      ? "bg-club-primary/10 font-bold text-club-primary"
                      : "text-foreground hover:bg-muted hover:text-club-primary"
                  }`}
                >
                  <span>{option.label}</span>
                  {selected && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-club-primary" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`relative flex flex-col space-y-1.5 ${className}`} ref={popoverRef}>
      {label && (
        <label
          htmlFor={uniqueId}
          className="flex items-center justify-between text-xs font-semibold text-foreground"
        >
          <span>
            {label} {required && <span className="text-red-500">*</span>}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono font-normal">
            (DD/MM/YYYY)
          </span>
        </label>
      )}

      <div className="relative flex items-center" dir="ltr">
        {/* Real Visible Input (Display Format: DD/MM/YYYY) */}
        <input
          id={uniqueId}
          ref={inputRef}
          type="text"
          dir="ltr"
          inputMode="numeric"
          pattern="\d{2}/\d{2}/\d{4}"
          placeholder={placeholder}
          value={displayValue}
          onChange={handleInputChange}
          onBlur={onBlur}
          disabled={disabled}
          required={required}
          className={`w-full rounded-xl border bg-background pl-3 pr-16 py-2 text-sm font-mono tracking-wider text-foreground placeholder:text-muted-foreground/60 transition-colors shadow-2xs outline-none focus:outline-none focus:ring-1 focus:ring-club-primary disabled:cursor-not-allowed disabled:opacity-60 ${
            isInvalid || error
              ? "border-red-500/80 focus:border-red-500 focus:ring-red-500/20"
              : "border-border hover:border-border/80 focus:border-club-primary"
          } ${inputClassName}`}
        />

        {/* Hidden Input for Standard Form Submissions (Passes ISO format to server) */}
        {name && <input type="hidden" name={name} value={isoValue || displayValue} />}

        {/* Action icons (Clear & Calendar Trigger) */}
        <div className="absolute right-2 flex items-center gap-1">
          {displayValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              title={isAr ? "مسح التاريخ" : "Effacer"}
              className="p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {showCalendar && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setOpenDateMenu(null);
                setIsOpen((prev) => !prev);
              }}
              title={isAr ? "اختيار من التقويم" : "Choisir une date"}
              className={`p-1.5 rounded-lg text-muted-foreground hover:text-club-primary hover:bg-muted/60 transition-colors outline-none focus:outline-none ${
                isOpen ? "bg-club-primary/10 text-club-primary" : ""
              }`}
            >
              <CalendarIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Validation Warning */}
      {isInvalid && (
        <p className="flex items-center gap-1 text-[11px] text-red-500 font-medium animate-in fade-in">
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span>
            {isAr
              ? "صيغة التاريخ يجب أن تكون DD/MM/YYYY صحيحة (مثال: 05/10/2026)"
              : "Format invalide. Utilisez JJ/MM/AAAA (ex: 05/10/2026)"}
          </span>
        </p>
      )}

      {error && !isInvalid && (
        <p className="text-[11px] text-red-500 font-medium">{error}</p>
      )}

      {helperText && !isInvalid && !error && (
        <p className="text-[11px] text-muted-foreground">{helperText}</p>
      )}

      {/* Interactive Calendar Dropdown / Popover */}
      {isOpen && !disabled && (
        <div
          dir={isAr ? "rtl" : "ltr"}
          className="absolute start-0 top-full z-50 mt-1.5 w-72 rounded-2xl border border-border bg-card p-4 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 select-none"
        >
          {/* Calendar Header: Month, Year, and Navigation Arrows */}
          <div className="flex items-center justify-between pb-3 border-b border-border/60 gap-1">
            <button
              type="button"
              onClick={prevMonth}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-muted/40 hover:bg-muted text-foreground transition-colors"
            >
              {isAr ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>

            <div ref={monthYearRef} className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              {monthMenu("month")}
              {monthMenu("year")}
            </div>

            <button
              type="button"
              onClick={nextMonth}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-muted/40 hover:bg-muted text-foreground transition-colors"
            >
              {isAr ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>

          {/* Weekday Names Header */}
          <div className="grid grid-cols-7 gap-1 py-2 text-center text-[10px] font-bold text-muted-foreground border-b border-border/40">
            {(isAr ? WEEKDAY_NAMES_AR : WEEKDAY_NAMES_FR).map((d, idx) => (
              <span key={idx}>{d}</span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 pt-2">
            {/* Blank offset days */}
            {Array.from({ length: (firstDayOfWeek + (isAr ? 1 : 0)) % 7 }).map((_, i) => (
              <span key={`blank-${i}`} className="h-8 w-8" />
            ))}

            {/* Days in month */}
            {Array.from({ length: daysInCurrentMonth }).map((_, i) => {
              const dayNum = i + 1;
              const formattedDay = String(dayNum).padStart(2, "0");
              const formattedMonth = String(calendarMonth + 1).padStart(2, "0");
              const dateStr = `${formattedDay}/${formattedMonth}/${calendarYear}`;
              const isSelected = displayValue === dateStr;
              const isToday =
                new Date().getDate() === dayNum &&
                new Date().getMonth() === calendarMonth &&
                new Date().getFullYear() === calendarYear;

              return (
                <button
                  key={dayNum}
                  type="button"
                  onClick={() => handleSelectDay(dayNum)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? "bg-club-primary text-white shadow-xs"
                      : isToday
                      ? "border border-club-primary/50 text-club-primary font-bold hover:bg-club-primary/10"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          {/* Footer Actions: Today & Format Hint */}
          <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-[11px]">
            <button
              type="button"
              onClick={handleSelectToday}
              className="font-bold text-club-primary hover:underline cursor-pointer"
            >
              {isAr ? "اليوم" : "Aujourd'hui"}
            </button>

            <span className="text-muted-foreground font-mono text-[10px]">
              DD/MM/YYYY
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
