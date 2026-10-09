"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, X } from "lucide-react";
import { ClubVideoPlayer } from "@/components/shared/club-video-player";

export function GalleryVideoModal({
  src,
  title,
  locale
}: {
  src: string;
  title: string;
  locale: string;
}) {
  const isAr = locale === "ar";
  const previewRef = useRef<HTMLVideoElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sourceRectRef = useRef<DOMRect | null>(null);
  const animationRef = useRef<Animation | null>(null);
  const restoreScrollY = useRef(0);
  const closeRef = useRef<() => void>(() => {});
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  const openPlayer = () => {
    sourceRectRef.current = triggerRef.current?.getBoundingClientRect() ?? null;
    restoreScrollY.current = window.scrollY;
    setOpen(true);
  };

  const animateFromSource = useCallback((reverse = false) => {
    const panel = panelRef.current;
    const overlay = overlayRef.current;
    const source = sourceRectRef.current;
    if (!panel || !source) return null;

    const destination = panel.getBoundingClientRect();
    if (!destination.width || !destination.height) return null;
    const dx = source.left + source.width / 2 - (destination.left + destination.width / 2);
    const dy = source.top + source.height / 2 - (destination.top + destination.height / 2);
    const sx = Math.max(0.04, source.width / destination.width);
    const sy = Math.max(0.04, source.height / destination.height);
    const originTransform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;

    animationRef.current?.cancel();
    const panelAnimation = panel.animate(
      reverse
        ? [{ transform: "translate(0, 0) scale(1)", opacity: 1 }, { transform: originTransform, opacity: 0.08 }]
        : [{ transform: originTransform, opacity: 0.72 }, { transform: "translate(0, 0) scale(1)", opacity: 1 }],
      {
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : reverse ? 360 : 480,
        easing: reverse ? "cubic-bezier(0.55, 0, 1, 0.45)" : "cubic-bezier(0.16, 1, 0.3, 1)",
        fill: "both"
      }
    );
    animationRef.current = panelAnimation;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    overlay?.animate(
      reverse ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 1 }],
      { duration: reducedMotion ? 1 : reverse ? 300 : 360, easing: "ease-out", fill: "both" }
    );
    return panelAnimation;
  }, []);

  const close = useCallback(() => {
    if (closing || !open) return;
    setClosing(true);
    const animation = animateFromSource(true);
    const finishClose = () => {
      setOpen(false);
      setClosing(false);
      animationRef.current = null;
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: restoreScrollY.current, behavior: "auto" });
        triggerRef.current?.focus({ preventScroll: true });
      });
    };
    if (animation) void animation.finished.catch(() => {}).then(finishClose);
    else window.setTimeout(finishClose, 100);
  }, [animateFromSource, closing, open]);
  closeRef.current = close;

  useEffect(() => {
    if (!open) return;
    previewRef.current?.pause();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const animationFrame = window.requestAnimationFrame(() => {
      animateFromSource(false);
      closeButtonRef.current?.focus({ preventScroll: true });
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      animationRef.current?.cancel();
    };
  }, [open, animateFromSource]);

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={openPlayer}
        aria-label={isAr ? `تشغيل ${title}` : `Lire ${title}`}
        className="group/video relative block h-full w-full touch-manipulation cursor-pointer overflow-hidden rounded-[inherit] bg-black text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-club-primary"
      >
        <video
          ref={previewRef}
          src={src}
          muted
          autoPlay
          loop
          playsInline
          preload="metadata"
          controlsList="nodownload noremoteplayback"
          disableRemotePlayback
          draggable={false}
          onContextMenu={(event) => event.preventDefault()}
          aria-hidden="true"
          className="h-full w-full object-contain transition-transform duration-300 group-hover/video:scale-[1.02]"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover/video:bg-black/25">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-club-primary/95 text-white shadow-xl transition-transform group-hover/video:scale-110 sm:h-16 sm:w-16">
            <Play className="ms-1 h-7 w-7 fill-white sm:h-8 sm:w-8" aria-hidden="true" />
          </span>
        </span>
      </button>

      {open && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black/75 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div ref={panelRef} className={`relative w-full max-w-6xl pt-11 sm:pt-0 ${closing ? "pointer-events-none" : ""}`}>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={close}
              aria-label={isAr ? "إغلاق مشغل الفيديو" : "Fermer le lecteur vidéo"}
              className="absolute top-0 end-0 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white shadow-lg transition-colors hover:bg-club-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:-top-12"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <ClubVideoPlayer src={src} title={title} aspectRatio="16/9" className="w-full max-h-[calc(88dvh-2.75rem)] sm:max-h-[88vh]" />
          </div>
        </div>
      )}
    </>
  );
}
