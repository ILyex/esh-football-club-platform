import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

const toneClasses = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-green-100 text-green-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-800"
} as const;

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof toneClasses }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", toneClasses[tone], className)}
      {...props}
    />
  );
}
