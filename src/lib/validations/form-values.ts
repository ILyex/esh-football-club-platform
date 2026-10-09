import { z } from "zod";

/** Parse native form booleans without treating the string "false" as true. */
export function formBoolean(defaultValue: boolean) {
  return z.preprocess((value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "on", "1", "yes"].includes(normalized)) return true;
      if (["false", "off", "0", "no", ""].includes(normalized)) return false;
    }
    return value;
  }, z.boolean().default(defaultValue));
}
