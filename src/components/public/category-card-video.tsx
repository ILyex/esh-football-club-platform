"use client";

import { useEffect, useRef, useState } from "react";
import { SafeImage } from "@/components/shared/safe-image";

type CategoryCardVideoProps = {
  src: string;
  poster: string;
  fallback: string;
  alt: string;
  className?: string;
};

/** Load category loops only as their cards approach the viewport. */
export function CategoryCardVideo({ src, poster, fallback, alt, className }: CategoryCardVideoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [motionAllowed, setMotionAllowed] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = "connection" in navigator && Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
    setMotionAllowed(!reduceMotion && !saveData);

    const element = containerRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      setNearViewport(Boolean(entry?.isIntersecting));
    }, { rootMargin: "160px", threshold: 0.01 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (nearViewport && motionAllowed) {
      void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      return;
    }
    video.pause();
    setPlaying(false);
  }, [motionAllowed, nearViewport]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <SafeImage
        src={poster}
        fallbackSrc={fallback}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={`pointer-events-none h-full w-full object-cover ${className ?? ""}`}
      />
      {nearViewport && motionAllowed && (
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          autoPlay
          loop
          muted
          playsInline
          controls={false}
          disablePictureInPicture
          disableRemotePlayback
          preload="none"
          aria-hidden="true"
          tabIndex={-1}
          onPlaying={() => setPlaying(true)}
          onError={() => setPlaying(false)}
          className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${playing ? "opacity-100" : "opacity-0"} ${className ?? ""}`}
        />
      )}
    </div>
  );
}
