"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";

/** Keeps Sonner's rich colours synchronized with the platform's user theme. */
export function PlatformToaster({ position }: { position: "top-left" | "top-right" }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setIsDark(root.classList.contains("dark"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return <Toaster position={position} theme={isDark ? "dark" : "light"} richColors />;
}
