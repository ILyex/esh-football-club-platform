"use client";

import { useEffect } from "react";

/**
 * A browser can keep an older RSC document after a local rebuild. If that
 * document requests a chunk from the previous build, recover once by doing a
 * hard reload instead of leaving the user on Next's chunk error screen.
 */
export function ChunkRecovery() {
  useEffect(() => {
    const isChunkError = (value: unknown) => {
      const text = value instanceof Error ? `${value.name} ${value.message}` : String(value ?? "");
      return /ChunkLoadError|Loading chunk|Loading CSS chunk|_next\/static\/chunks/.test(text);
    };
    const recover = (value: unknown) => {
      if (!isChunkError(value)) return;
      try {
        const url = new URL(window.location.href);
        // Retry a small, bounded number of times. Multiple attempts are needed
        // when an open App Router tab still holds an older RSC payload after a
        // rebuild; the cap prevents an endless reload loop for a real failure.
        const attempt = Number(url.searchParams.get("esh_reload_attempt") || "0");
        if (attempt >= 3) return;
        url.searchParams.delete("esh_reload");
        url.searchParams.set("esh_reload_attempt", String(attempt + 1));
        window.location.replace(url.toString());
        return;
      } catch {
        // Continue with a normal reload when URL construction is unavailable.
      }
      window.location.reload();
    };
    const onError = (event: ErrorEvent) => recover(event.error ?? event.message);
    const onRejection = (event: PromiseRejectionEvent) => recover(event.reason);
    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
