"use client";

type OpponentNameFrInputProps = {
  id: string;
  name: string;
  defaultValue: string;
  disabled?: boolean;
  placeholder?: string;
  className: string;
};

export function OpponentNameFrInput({
  id,
  name,
  defaultValue,
  disabled = false,
  placeholder = "OM Mahdia",
  className
}: OpponentNameFrInputProps) {
  return (
    <input
      id={id}
      name={name}
      defaultValue={defaultValue}
      dir="ltr"
      maxLength={120}
      disabled={disabled}
      placeholder={placeholder}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.preventDefault();
      }}
      className={className}
    />
  );
}
