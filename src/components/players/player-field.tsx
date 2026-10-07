"use client";

type PlayerFieldProps = {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  disabled?: boolean;
  step?: string;
  min?: number;
  max?: number;
};

export function PlayerField({
  label,
  name,
  type = "text",
  defaultValue,
  disabled,
  step,
  min,
  max
}: PlayerFieldProps) {
  return (
    <div>
      <label htmlFor={`player-${name}`} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <input
        id={`player-${name}`}
        name={name}
        type={type}
        defaultValue={defaultValue}
        disabled={disabled}
        step={step}
        min={min}
        max={max}
        onChange={(event) => {
          if (min !== undefined && event.currentTarget.value.startsWith("-") && Number(event.currentTarget.value) < 0) {
            event.currentTarget.value = String(min);
          }
        }}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
      />
    </div>
  );
}
