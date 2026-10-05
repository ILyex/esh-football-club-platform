"use client";

import { useState, useRef, useEffect, useId } from "react";
import { ChevronDown, Check, Layers, type LucideIcon } from "lucide-react";

export interface MasterFilterOption {
  id: string;
  label: string;
  icon?: LucideIcon;
  badge?: string | number;
}

export interface MasterFilterSelectProps {
  label?: string;
  value: string;
  options: MasterFilterOption[];
  onChange?: (value: string) => void;
  icon?: LucideIcon;
  iconSize?: "default" | "prominent";
  placeholder?: string;
  headerTitle?: string;
  className?: string;
  align?: "start" | "end";
  size?: "default" | "sm";
  disabled?: boolean;
  /** Give the selected option a high-contrast club-colored treatment. */
  emphasizeValue?: boolean;
  surface?: "card" | "muted";
  /** Submit the selected value with a surrounding GET/POST form. */
  name?: string;
  locale?: "ar" | "fr";
}

/**
 * Master Reference Component for all Dropdowns, Popovers, and Selectors.
 * Derived strictly from the InsuranceCategorySelect reference specification.
 */
export function MasterFilterSelect({
  label,
  value,
  options,
  onChange,
  icon: Icon,
  iconSize = "default",
  placeholder,
  headerTitle,
  className = "",
  align = "end",
  size = "default",
  disabled = false,
  emphasizeValue = false,
  surface = "card",
  name,
  locale = "ar",
}: MasterFilterSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => setSelectedValue(value), [value]);

  const selectedOption = options.find((o) => o.id === selectedValue);
  const currentLabel = selectedOption ? selectedOption.label : placeholder ?? (locale === "ar" ? "اختر..." : "Choisir...");

  // Close dropdown on click outside or escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (id: string) => {
    setSelectedValue(id);
    setIsOpen(false);
    onChange?.(id);
  };

  const padY = size === "sm" ? "py-1 px-3" : "py-1.5 px-3.5";

  return (
    <div ref={containerRef} data-filter-control className={`relative inline-block text-start ${className}`}>
      {name && <input type="hidden" name={name} value={selectedValue} />}
      {/* Trigger Button */}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`inline-flex items-center gap-2 rounded-xl border ${surface === "muted" ? "bg-muted/60 hover:bg-muted/80" : "bg-card"} ${padY} shadow-2xs transition-all ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${
          isOpen
            ? "border-club-primary ring-2 ring-club-primary/20 text-foreground"
            : "border-border/80 hover:border-club-primary/50 text-foreground"
        }`}
      >
        {(Icon || label) && (
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 shrink-0 whitespace-nowrap">
            {(() => {
              const TriggerIcon = Icon ?? Layers;
              return <TriggerIcon className={`${iconSize === "prominent" ? "h-[18px] w-[18px]" : "h-4 w-4"} text-club-primary shrink-0`} />;
            })()}
            {label && <span>{label}</span>}
          </span>
        )}

        <span className={`max-w-[130px] truncate text-xs font-bold sm:max-w-[170px] ${emphasizeValue ? "rounded-md bg-club-primary/10 px-2 py-1 text-club-primary" : "text-foreground"}`}>
          {currentLabel}
        </span>

        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0 ${
            isOpen ? "rotate-180 text-club-primary" : ""
          }`}
        />
      </button>

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <div
          id={menuId}
          role="menu"
          aria-orientation="vertical"
          className={`absolute z-50 mt-1.5 min-w-[200px] sm:min-w-[220px] rounded-xl border border-border bg-card p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150 ${
            align === "end" ? "end-0" : "start-0"
          }`}
        >
          {headerTitle && (
            <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50 mb-1">
              {headerTitle}
            </div>
          )}

          <div className="max-h-60 overflow-y-auto space-y-0.5">
            {options.map((option) => {
              const isSelected = selectedValue === option.id;
              const OptionIcon = option.icon;

              return (
                <button
                  key={option.id}
                  type="button"
                  role="menuitem"
                  onClick={() => handleSelect(option.id)}
                  className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors text-start cursor-pointer ${
                    isSelected
                      ? "bg-club-primary/10 text-club-primary font-bold"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {OptionIcon && (
                      <OptionIcon
                        className={`h-4 w-4 shrink-0 ${
                          isSelected ? "text-club-primary" : "text-muted-foreground"
                        }`}
                      />
                    )}
                    <span className="truncate">{option.label}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ms-2">
                    {option.badge !== undefined && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
                        {option.badge}
                      </span>
                    )}
                    {isSelected && <Check className="h-4 w-4 text-club-primary shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
