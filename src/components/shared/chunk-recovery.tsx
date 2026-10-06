"use client";

import { useEffect } from "react";

/**
 * A browser can keep an older RSC document after a local rebuild. If that
 * document requests a chunk from the previous build, recover once by doing a
 * hard reload instead of leaving the user on Next's chunk error screen.
 */
export function ChunkRecovery() {
  useEffect(() => {
    const key = "esh-chunk-recovery";
    const isChunkError = (value: unknown) => {
      const text = value instanceof Error ? `${value.name} ${value.message}` : String(value ?? "");
      return /ChunkLoadError|Loading chunk|Loading CSS chunk|_next\/static\/chunks/.test(text);
    };
    const recover = (value: unknown) => {
      if (!isChunkError(value)) return;
      try {
        if (sessionStorage.getItem(key) === window.location.pathname) return;
        sessionStorage.setItem(key, window.location.pathname);
      } catch {
        // Continue with a normal reload when storage is unavailable.
      }
      window.location.reload();
    };
    const onError = (event: ErrorEvent) => recover(event.error ?? event.message);
    const onRejection = (event: PromiseRejectionEvent) => recover(event.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    const timer = window.setTimeout(() => {
      try { sessionStorage.removeItem(key); } catch { /* private browsing */ }
    }, 10_000);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
