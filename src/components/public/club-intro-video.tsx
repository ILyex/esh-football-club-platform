"use client";

import { useEffect, useRef } from "react";

interface ClubIntroVideoProps {
  label: string;
  poster?: string;
  videoSrc?: string;
}

export function ClubIntroVideo({ label, poster = "/branding/esh-intro-poster.jpg", videoSrc = "/branding/esh-intro-loop.mp4" }: ClubIntroVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let isVisible = false;

    const syncPlayback = () => {
      if (reducedMotion.matches || !isVisible) {
        video.pause();
        return;
      }

      void video.play().catch(() => undefined);
    };

    const observer = new IntersectionObserver((entries) => {
      isVisible = entries[0]?.isIntersecting ?? false;
      syncPlayback();
    }, { threshold: 0.25 });

    observer.observe(video);
    reducedMotion.addEventListener("change", syncPlayback);

    return () => {
      observer.disconnect();
      reducedMotion.removeEventListener("change", syncPlayback);
      video.pause();
    };
  }, []);

  return (
    <div
      role="img"
      aria-label={label}
      className="relative aspect-video w-full overflow-hidden rounded-xl border border-club-primary/20 bg-[#760015] shadow-sm"
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        src={videoSrc}
        poster={poster}
        muted
        loop
        playsInline
        preload="none"
        disablePictureInPicture
        aria-hidden="true"
      />
    </div>
  );
}
