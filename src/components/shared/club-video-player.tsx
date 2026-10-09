"use client";

import { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  RotateCcw,
  Film,
  Rewind,
  FastForward,
  PictureInPicture2,
  LoaderCircle
} from "lucide-react";

export interface ClubVideoPlayerProps {
  src: string;
  poster?: string | null;
  title?: string | null;
  className?: string;
  aspectRatio?: "16/9" | "4/3" | "video";
  autoPlayOnVisible?: boolean;
}

export function ClubVideoPlayer({
  src,
  poster,
  title,
  className = "",
  aspectRatio = "16/9",
  autoPlayOnVisible = false
}: ClubVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [hasError, setHasError] = useState(false);
  const [supportsPictureInPicture, setSupportsPictureInPicture] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const [isRtl, setIsRtl] = useState(false);
  const hideControlsTimeout = useRef<NodeJS.Timeout | null>(null);
  const tapTimeout = useRef<number | null>(null);
  const seekFeedbackTimeout = useRef<number | null>(null);
  const previousVolume = useRef(1);
  const [seekFeedback, setSeekFeedback] = useState<{ direction: "backward" | "forward"; side: "left" | "right"; id: number } | null>(null);

  useEffect(() => {
    setIsRtl(document.documentElement.dir === "rtl");
    setSupportsPictureInPicture(document.pictureInPictureEnabled);
  }, []);

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setHasStarted(true);
        })
        .catch(() => {});
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    if (videoRef.current.muted || volume === 0) {
      const restoredVolume = Math.max(previousVolume.current, 0.35);
      videoRef.current.volume = restoredVolume;
      videoRef.current.muted = false;
      setVolume(restoredVolume);
      setIsMuted(false);
    } else {
      previousVolume.current = volume;
      videoRef.current.muted = true;
      setIsMuted(true);
    }
  };

  const updateVolume = (nextVolume: number) => {
    const normalizedVolume = Math.min(1, Math.max(0, nextVolume));
    if (!videoRef.current) return;
    videoRef.current.volume = normalizedVolume;
    videoRef.current.muted = normalizedVolume === 0;
    if (normalizedVolume > 0) previousVolume.current = normalizedVolume;
    setVolume(normalizedVolume);
    setIsMuted(normalizedVolume === 0);
  };

  const showSeekFeedback = (direction: "backward" | "forward", side: "left" | "right") => {
    if (seekFeedbackTimeout.current !== null) window.clearTimeout(seekFeedbackTimeout.current);
    setSeekFeedback({ direction, side, id: Date.now() });
    seekFeedbackTimeout.current = window.setTimeout(() => setSeekFeedback(null), 650);
  };

  const handleVideoTap = (event: React.MouseEvent<HTMLVideoElement>) => {
    if (tapTimeout.current !== null) {
      window.clearTimeout(tapTimeout.current);
      tapTimeout.current = null;
      const rect = event.currentTarget.getBoundingClientRect();
      const side = event.clientX - rect.left < rect.width / 2 ? "left" : "right";
      const direction = side === "left" ? "forward" : "backward";
      skipBy(direction === "forward" ? 5 : -5);
      showSeekFeedback(direction, side);
      return;
    }
    tapTimeout.current = window.setTimeout(() => {
      tapTimeout.current = null;
      togglePlay();
    }, 280);
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const skipBy = (seconds: number) => {
    if (!videoRef.current) return;
    const duration = videoRef.current.duration || Number.POSITIVE_INFINITY;
    videoRef.current.currentTime = Math.min(Math.max(videoRef.current.currentTime + seconds, 0), duration);
    setShowControls(true);
  };

  const cyclePlaybackRate = () => {
    if (!videoRef.current) return;
    const rates = [1, 1.25, 1.5, 2];
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length] ?? 1;
    videoRef.current.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const togglePictureInPicture = async () => {
    const video = videoRef.current;
    if (!video || !document.pictureInPictureEnabled) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch {}
  };

  const handlePlayerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const key = event.key.toLowerCase();
    if (key === " " || key === "k") {
      event.preventDefault();
      togglePlay();
    } else if (key === "arrowleft") {
      event.preventDefault();
      skipBy(-10);
    } else if (key === "arrowright") {
      event.preventDefault();
      skipBy(10);
    } else if (key === "m") {
      event.preventDefault();
      toggleMute();
    } else if (key === "arrowup") {
      event.preventDefault();
      updateVolume(volume + 0.05);
    } else if (key === "arrowdown") {
      event.preventDefault();
      updateVolume(volume - 0.05);
    } else if (key === "f") {
      event.preventDefault();
      void toggleFullscreen();
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    const dur = videoRef.current.duration || 0;
    setCurrentTime(cur);
    setDuration(dur);
    setProgress(dur > 0 ? (cur / dur) * 100 : 0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const targetTime = (parseFloat(e.target.value) / 100) * (videoRef.current.duration || 0);
    videoRef.current.currentTime = targetTime;
    setProgress(parseFloat(e.target.value));
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimeout.current) clearTimeout(hideControlsTimeout.current);
    if (isPlaying) {
      hideControlsTimeout.current = setTimeout(() => {
        setShowControls(false);
      }, 2500);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      if (hideControlsTimeout.current) clearTimeout(hideControlsTimeout.current);
      if (tapTimeout.current !== null) window.clearTimeout(tapTimeout.current);
      if (seekFeedbackTimeout.current !== null) window.clearTimeout(seekFeedbackTimeout.current);
    };
  }, []);

  useEffect(() => {
    if (!autoPlayOnVisible || !containerRef.current || !videoRef.current) return;
    const container = containerRef.current;
    const video = videoRef.current;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        video.muted = true;
        setIsMuted(true);
        void video.play().then(() => {
          setIsPlaying(true);
          setHasStarted(true);
        }).catch(() => {});
      } else {
        video.pause();
        setIsPlaying(false);
      }
    }, { threshold: 0.6 });
    observer.observe(container);
    return () => observer.disconnect();
  }, [autoPlayOnVisible]);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onTouchStart={() => setShowControls(true)}
      onKeyDown={handlePlayerKeyDown}
      tabIndex={0}
      role="group"
      aria-label={title || (isRtl ? "مشغل فيديو النادي" : "Lecteur vidéo du club")}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
      className={`group relative overflow-hidden rounded-2xl border border-border/80 bg-black shadow-lg select-none outline-none focus-visible:ring-2 focus-visible:ring-club-primary [:fullscreen]:flex [:fullscreen]:h-screen [:fullscreen]:w-screen [:fullscreen]:items-center [:fullscreen]:justify-center [:fullscreen]:rounded-none [:fullscreen]:border-0 ${className}`}
    >
      <div className={`relative w-full ${aspectRatio === "4/3" ? "aspect-[4/3] min-h-[160px] sm:min-h-[180px]" : "aspect-[16/9] min-h-[180px] sm:min-h-[200px]"} bg-black flex items-center justify-center [:fullscreen]:h-screen [:fullscreen]:max-h-screen [:fullscreen]:max-w-screen [:fullscreen]:aspect-auto`}>
        <video
          ref={videoRef}
          src={src}
          poster={poster ?? undefined}
          preload="metadata"
          playsInline
          controlsList="nodownload noremoteplayback"
          disableRemotePlayback
          draggable={false}
          onContextMenu={(event) => event.preventDefault()}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => { setIsBuffering(false); setHasError(false); }}
          onCanPlay={() => setIsBuffering(false)}
          onError={() => { setIsBuffering(false); setHasError(true); }}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleTimeUpdate}
          onEnded={() => setIsPlaying(false)}
          onClick={handleVideoTap}
          className="h-full w-full touch-manipulation object-contain cursor-pointer"
        />

        {seekFeedback && (
          <div
            key={seekFeedback.id}
            className={`pointer-events-none absolute inset-y-0 z-20 flex w-1/3 items-center justify-center animate-in fade-in zoom-in-90 duration-150 ${seekFeedback.side === "left" ? "left-0" : "right-0"}`}
            aria-live="polite"
          >
            <span dir="ltr" className="flex min-w-[5.25rem] flex-col items-center gap-2 rounded-2xl border border-white/15 bg-black/70 px-4 py-3 text-white shadow-xl shadow-black/30 backdrop-blur-md">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
                {seekFeedback.direction === "backward"
                  ? <Rewind className={`h-5 w-5 ${isRtl ? "-scale-x-100" : ""}`} aria-hidden="true" />
                  : <FastForward className={`h-5 w-5 ${isRtl ? "-scale-x-100" : ""}`} aria-hidden="true" />}
              </span>
              <span className="text-xs font-extrabold tabular-nums">{seekFeedback.direction === "backward" ? "−5s" : "+5s"}</span>
            </span>
          </div>
        )}

        {isBuffering && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-white" aria-live="polite">
            <span className="flex items-center gap-2 rounded-full bg-black/65 px-4 py-2 text-xs font-semibold backdrop-blur-sm">
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              {isRtl ? "جارٍ تحميل الفيديو…" : "Chargement de la vidéo…"}
            </span>
          </div>
        )}

        {hasError && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/70 px-6 text-center text-sm font-semibold text-white" role="status">
            {isRtl ? "تعذر تشغيل هذا الفيديو. تحقق من الاتصال أو جرّب مرة أخرى." : "Impossible de lire cette vidéo. Vérifiez la connexion ou réessayez."}
          </div>
        )}

        {/* Big Center Play Button Overlay before play / when paused */}
        {(!isPlaying || !hasStarted) && (
          <button
            type="button"
            onClick={togglePlay}
            className="absolute inset-0 m-auto flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-club-primary/90 text-white shadow-2xl backdrop-blur-xs transition-all hover:scale-110 hover:bg-club-primary active:scale-95 cursor-pointer z-10"
            aria-label={isRtl ? "تشغيل الفيديو" : "Lire la vidéo"}
          >
            <Play className="h-8 w-8 sm:h-10 sm:w-10 fill-white translate-x-0.5" />
          </button>
        )}

        {/* Top Badging / Title */}
        <div
          className={`absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 z-10 flex items-center justify-between pointer-events-none ${
            showControls || !isPlaying ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="flex items-center gap-2 text-white">
            <span className="flex items-center gap-1 rounded-md bg-club-primary/80 px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase">
              <Film className="h-3 w-3" />
              <span>{isRtl ? "فيديو النادي" : "Vidéo du club"}</span>
            </span>
            {title && title !== "فيديو النادي" && title !== "فيديو من النادي" && title !== "Club video" && title !== "Vidéo du club" && (
              <span className="text-xs font-semibold truncate max-w-sm drop-shadow-xs">{title}</span>
            )}
          </div>
        </div>

        {/* Bottom Control Bar */}
        <div
          className={`absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent transition-opacity duration-300 z-10 flex flex-col gap-2 ${
            showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          {/* Seek Progress Bar */}
          <div className="relative flex w-full items-center py-1 group/slider">
            <input
              type="range"
              min="0"
              max="100"
              step="0.1"
              value={progress}
              onChange={handleSeek}
              aria-label={isRtl ? "موضع الفيديو" : "Position dans la vidéo"}
              className="h-2.5 w-full cursor-pointer appearance-none rounded-lg bg-white/30 accent-club-primary transition-all hover:h-3"
              style={{
                background: isRtl
                  ? `linear-gradient(to left, #B31B1B ${progress}%, rgba(255,255,255,0.3) ${progress}%)`
                  : `linear-gradient(to right, #B31B1B ${progress}%, rgba(255,255,255,0.3) ${progress}%)`
              }}
            />
          </div>

          {/* Action Buttons Row */}
          <div className="flex items-center justify-between gap-1 text-xs text-white">
            <div className="flex min-w-0 items-center gap-0.5 sm:gap-2.5">
              {/* Play / Pause */}
              <button
                type="button"
                onClick={togglePlay}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg p-1.5 transition-colors hover:bg-white/20 sm:h-8 sm:w-8"
                aria-label={isPlaying ? (isRtl ? "إيقاف مؤقت" : "Pause") : (isRtl ? "تشغيل" : "Lire")}
              >
                {isPlaying ? <Pause className="h-5 w-5 fill-white" /> : <Play className="h-5 w-5 fill-white" />}
              </button>

              <button type="button" onClick={() => skipBy(-10)} className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg p-1.5 transition-colors hover:bg-white/20 sm:inline-flex" aria-label={isRtl ? "رجوع 10 ثوانٍ" : "Reculer de 10 secondes"} title={isRtl ? "رجوع 10 ثوانٍ" : "Reculer de 10 secondes"}>
                <Rewind className={`h-4 w-4 ${isRtl ? "-scale-x-100" : ""}`} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => skipBy(10)} className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg p-1.5 transition-colors hover:bg-white/20 sm:inline-flex" aria-label={isRtl ? "تقديم 10 ثوانٍ" : "Avancer de 10 secondes"} title={isRtl ? "تقديم 10 ثوانٍ" : "Avancer de 10 secondes"}>
                <FastForward className={`h-4 w-4 ${isRtl ? "-scale-x-100" : ""}`} aria-hidden="true" />
              </button>

              {/* Mute / Unmute */}
              <button
                type="button"
                onClick={toggleMute}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg p-1.5 transition-colors hover:bg-white/20 sm:h-8 sm:w-8"
                aria-label={isMuted ? (isRtl ? "تشغيل الصوت" : "Activer le son") : (isRtl ? "كتم الصوت" : "Couper le son")}
              >
                {isMuted ? <VolumeX className="h-5 w-5 text-red-400" /> : <Volume2 className="h-5 w-5" />}
              </button>

              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(event) => updateVolume(Number(event.target.value))}
                aria-label={isRtl ? "مستوى الصوت" : "Volume"}
                title={isRtl ? "مستوى الصوت" : "Volume"}
                className="h-1.5 w-12 shrink-0 cursor-pointer accent-club-primary sm:w-20"
              />

              {/* Timestamp */}
              <div className="ms-1 whitespace-nowrap font-mono text-[9px] text-white/90 tabular-nums sm:ms-0 sm:text-[11px]">
                <span>{formatTime(currentTime)}</span>
                <span className="mx-1 text-white/50">/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-0.5 sm:gap-2">
              <button type="button" onClick={cyclePlaybackRate} className="hidden h-8 min-w-10 items-center justify-center rounded-lg px-2 text-[11px] font-bold tabular-nums transition-colors hover:bg-white/20 sm:inline-flex" aria-label={isRtl ? `سرعة التشغيل ${playbackRate}×` : `Vitesse ${playbackRate}×`} title={isRtl ? "تغيير سرعة التشغيل" : "Changer la vitesse"}>
                {playbackRate}×
              </button>
              {supportsPictureInPicture && (
                <button type="button" onClick={() => void togglePictureInPicture()} className="hidden h-8 w-8 items-center justify-center rounded-lg p-1.5 transition-colors hover:bg-white/20 sm:inline-flex" aria-label={isRtl ? "تشغيل داخل نافذة عائمة" : "Lire dans une fenêtre flottante"} title={isRtl ? "نافذة عائمة" : "Image dans l’image"}>
                  <PictureInPicture2 className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
              {/* Reset to Start */}
              <button
                type="button"
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = 0;
                  }
                }}
                className="hidden h-8 w-8 items-center justify-center rounded-lg p-1.5 transition-colors hover:bg-white/20 sm:inline-flex"
                aria-label={isRtl ? "إعادة من البداية" : "Recommencer"}
                title={isRtl ? "إعادة من البداية" : "Recommencer"}
              >
                <RotateCcw className="h-4 w-4" />
              </button>

              {/* Fullscreen */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg p-1.5 transition-colors hover:bg-white/20 sm:h-8 sm:w-8"
                aria-label={isRtl ? "ملء الشاشة" : "Plein écran"}
              >
                {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
