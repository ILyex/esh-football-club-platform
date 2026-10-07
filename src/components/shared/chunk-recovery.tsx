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
        // Retry once per document URL. The marker prevents an endless loop if
        // the chunk is genuinely unavailable, while allowing repeated failures
        // on the same route after a rebuild or server restart.
        if (url.searchParams.has("esh_reload")) return;
        url.searchParams.set("esh_reload", String(Date.now()));
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
