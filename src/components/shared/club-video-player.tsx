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
  Film
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
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const hideControlsTimeout = useRef<NodeJS.Timeout | null>(null);

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
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
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
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      className={`group relative overflow-hidden rounded-2xl bg-black shadow-lg border border-border/80 select-none ${className}`}
    >
      <div className={`relative w-full ${aspectRatio === "4/3" ? "aspect-[4/3] min-h-[180px]" : "aspect-[16/9] min-h-[200px]"} bg-black flex items-center justify-center`}>
        <video
          ref={videoRef}
          src={src}
          poster={poster ?? undefined}
          preload="metadata"
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleTimeUpdate}
          onEnded={() => setIsPlaying(false)}
          onClick={togglePlay}
          className="h-full w-full object-contain cursor-pointer"
        />

        {/* Big Center Play Button Overlay before play / when paused */}
        {(!isPlaying || !hasStarted) && (
          <button
            type="button"
            onClick={togglePlay}
            className="absolute inset-0 m-auto flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-club-primary/90 text-white shadow-2xl backdrop-blur-xs transition-all hover:scale-110 hover:bg-club-primary active:scale-95 cursor-pointer z-10"
            aria-label="Play Video"
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
              <span>فيديو النادي</span>
            </span>
            {title && <span className="text-xs font-semibold truncate max-w-sm drop-shadow-xs">{title}</span>}
          </div>
        </div>

        {/* Bottom Control Bar */}
        <div
          className={`absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent transition-opacity duration-300 z-10 flex flex-col gap-2 ${
            showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          {/* Seek Progress Bar */}
          <div className="relative flex items-center w-full group/slider">
            <input
              type="range"
              min="0"
              max="100"
              step="0.1"
              value={progress}
              onChange={handleSeek}
              className="w-full h-1.5 bg-white/30 rounded-lg appearance-none cursor-pointer accent-club-primary hover:h-2 transition-all"
              style={{
                background: `linear-gradient(to right, #B31B1B ${progress}%, rgba(255,255,255,0.3) ${progress}%)`
              }}
            />
          </div>

          {/* Action Buttons Row */}
          <div className="flex items-center justify-between text-white text-xs">
            <div className="flex items-center gap-3">
              {/* Play / Pause */}
              <button
                type="button"
                onClick={togglePlay}
                className="p-1 rounded-lg hover:bg-white/20 transition-colors cursor-pointer"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="h-5 w-5 fill-white" /> : <Play className="h-5 w-5 fill-white" />}
              </button>

              {/* Mute / Unmute */}
              <button
                type="button"
                onClick={toggleMute}
                className="p-1 rounded-lg hover:bg-white/20 transition-colors cursor-pointer"
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeX className="h-5 w-5 text-red-400" /> : <Volume2 className="h-5 w-5" />}
              </button>

              {/* Timestamp */}
              <div className="font-mono text-[11px] text-white/90 tabular-nums">
                <span>{formatTime(currentTime)}</span>
                <span className="mx-1 text-white/50">/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Reset to Start */}
              <button
                type="button"
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = 0;
                  }
                }}
                className="p-1 rounded-lg hover:bg-white/20 transition-colors cursor-pointer"
                title="إعادة من البداية"
              >
                <RotateCcw className="h-4 w-4" />
              </button>

              {/* Fullscreen */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-1 rounded-lg hover:bg-white/20 transition-colors cursor-pointer"
                aria-label="Fullscreen"
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
