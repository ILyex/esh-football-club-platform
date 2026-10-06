"use client";

import { useEffect } from "react";

/**
 * A browser can keep an older RSC document after a local rebuild. If that
 * document requests a chunk from the previous build, recover once by doing a
 * hard reload instead of leaving the user on Next's chunk error screen.
 */
export function ChunkRecovery() {
  useEffect(() => {
    const key = "esh-chunk-recovery-v2";
    const isChunkError = (value: unknown) => {
      const text = value instanceof Error ? `${value.name} ${value.message}` : String(value ?? "");
      return /ChunkLoadError|Loading chunk|Loading CSS chunk|_next\/static\/chunks/.test(text);
    };
    const recover = (value: unknown) => {
      if (!isChunkError(value)) return;
      try {
        const current = window.location.pathname;
        const previous = sessionStorage.getItem(key);
        if (previous === current) return;
        // Navigate to a fresh document immediately. A normal reload can reuse
        // the old RSC payload in an open tab and request the same stale chunk.
        sessionStorage.setItem(key, current);
        const separator = window.location.search ? "&" : "?";
        window.location.assign(`${window.location.href}${separator}esh_reload=${Date.now()}`);
        return;
      } catch {
        // Continue with a normal reload when storage is unavailable.
      }
      window.location.reload();
    };
    const onError = (event: ErrorEvent) => recover(event.error ?? event.message);
    const onRejection = (event: PromiseRejectionEvent) => recover(event.reason);
    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onRejection);
    const timer = window.setTimeout(() => {
      try { sessionStorage.removeItem(key); } catch { /* private browsing */ }
    }, 10_000);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
