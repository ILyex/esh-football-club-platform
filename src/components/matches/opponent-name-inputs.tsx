"use client";

import { useEffect, useState } from "react";

type OpponentNameInputsProps = {
  arabicId: string;
  frenchId: string;
  arabicLabel: string;
  frenchLabel: string;
  arabicValue: string;
  frenchValue: string;
  disabled?: boolean;
  arabicClassName: string;
  frenchClassName: string;
};

/** Keep both editable names controlled so React form actions cannot reset
 * the visible values to the server-rendered defaults after a successful save. */
export function OpponentNameInputs({
  arabicId,
  frenchId,
  arabicLabel,
  frenchLabel,
  arabicValue,
  frenchValue,
  disabled = false,
  arabicClassName,
  frenchClassName
}: OpponentNameInputsProps) {
  const [arabicName, setArabicName] = useState(arabicValue);
  const [frenchName, setFrenchName] = useState(frenchValue);

  useEffect(() => setArabicName(arabicValue), [arabicValue]);
  useEffect(() => setFrenchName(frenchValue), [frenchValue]);

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="min-w-0">
        <label htmlFor={arabicId} className="mb-1.5 block text-xs font-semibold text-muted-foreground">
          {arabicLabel}
        </label>
        <input
          id={arabicId}
          name="opponent"
          value={arabicName}
          onChange={(event) => setArabicName(event.target.value)}
          dir="rtl"
          required
          maxLength={120}
          disabled={disabled}
          className={arabicClassName}
        />
      </div>
      <div className="min-w-0">
        <label htmlFor={frenchId} className="mb-1.5 block text-xs font-semibold text-muted-foreground">
          {frenchLabel}
        </label>
        <input
          id={frenchId}
          name="opponentNameFr"
          value={frenchName}
          onChange={(event) => setFrenchName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.preventDefault();
          }}
          dir="ltr"
          maxLength={120}
          disabled={disabled}
          placeholder="OM Mahdia"
          className={frenchClassName}
        />
      </div>
    </div>
  );
}
