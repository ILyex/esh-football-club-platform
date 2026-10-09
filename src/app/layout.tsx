import type { ReactNode } from "react";
import { ChunkRecovery } from "@/components/shared/chunk-recovery";

// Root layout is intentionally minimal — locale-specific <html lang dir>,
// fonts and providers all live in src/app/[locale]/layout.tsx, since the
// direction (RTL/LTR) can only be known once the locale segment resolves.
export default function RootLayout({ children }: { children: ReactNode }) {
  return <><ChunkRecovery />{children}</>;
}
