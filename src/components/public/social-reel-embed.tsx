"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Play, RotateCcw } from "lucide-react";

type FacebookVideoPlayer = {
  subscribe: (event: "finishedPlaying", callback: () => void) => unknown;
  seek: (seconds: number) => void;
  play: () => void;
};

type FacebookSdk = {
  init: (options: { xfbml: boolean; version: string }) => void;
  XFBML: { parse: (root?: HTMLElement) => void };
  Event: {
    subscribe: (event: "xfbml.ready", callback: (message: { type?: string; id?: string; instance?: FacebookVideoPlayer }) => void) => void;
    unsubscribe?: (event: "xfbml.ready", callback: (message: { type?: string; id?: string; instance?: FacebookVideoPlayer }) => void) => void;
  };
};

type InstagramEmbedSdk = {
  Embeds: { process: () => void };
};

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
    instgrm?: InstagramEmbedSdk;
  }
}

let facebookSdkPromise: Promise<FacebookSdk> | null = null;
let instagramEmbedPromise: Promise<InstagramEmbedSdk> | null = null;
let instagramProcessTimer: number | null = null;

function processInstagramEmbeds(sdk: InstagramEmbedSdk) {
  if (instagramProcessTimer !== null) return;
  instagramProcessTimer = window.setTimeout(() => {
    instagramProcessTimer = null;
    sdk.Embeds.process();
  }, 0);
}

function loadInstagramEmbedSdk(): Promise<InstagramEmbedSdk> {
  if (typeof window === "undefined") return Promise.reject(new Error("Instagram embeds are client-only."));
  if (window.instgrm) return Promise.resolve(window.instgrm);
  if (instagramEmbedPromise) return instagramEmbedPromise;

  instagramEmbedPromise = new Promise<InstagramEmbedSdk>((resolve, reject) => {
    const scriptId = "instagram-embed-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    const onLoad = () => window.instgrm ? resolve(window.instgrm) : reject(new Error("Instagram embed SDK did not initialize."));
    const onError = () => reject(new Error("Instagram embed SDK could not be loaded."));
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.async = true;
      script.src = "https://www.instagram.com/embed.js";
      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", onError, { once: true });
      document.head.appendChild(script);
    } else {
      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", onError, { once: true });
    }
  }).catch((error) => {
    instagramEmbedPromise = null;
    throw error;
  });

  return instagramEmbedPromise;
}

function InstagramReelEmbed({ src, url, title }: { src: string; url: string; title: string }) {
  const embedRef = useRef<HTMLQuoteElement>(null);
  const [sdkUnavailable, setSdkUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    void loadInstagramEmbedSdk().then((sdk) => {
      if (active && embedRef.current) processInstagramEmbeds(sdk);
    }).catch(() => {
      if (active) setSdkUnavailable(true);
    });
    return () => { active = false; };
  }, [url]);

  if (sdkUnavailable) {
    return <iframe src={src} title={title} loading="lazy" allow="autoplay; encrypted-media; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" className="block min-h-[680px] w-full border-0" />;
  }

  return (
    <div className="absolute inset-0 flex h-full w-full justify-center overflow-hidden bg-black">
      <blockquote
        ref={embedRef}
        className="instagram-media"
        data-instgrm-permalink={url}
        data-instgrm-version="14"
        style={{ background: "#fff", border: 0, borderRadius: 3, boxShadow: "none", height: "100%", margin: 0, maxHeight: "100%", maxWidth: 540, minWidth: 0, overflow: "hidden", padding: 0, width: "100%" }}
      >
        <a href={url} target="_blank" rel="noreferrer">Instagram</a>
      </blockquote>
    </div>
  );
}

function loadFacebookSdk(): Promise<FacebookSdk> {
  if (typeof window === "undefined") return Promise.reject(new Error("Facebook SDK is client-only."));
  if (window.FB) return Promise.resolve(window.FB);
  if (facebookSdkPromise) return facebookSdkPromise;

  facebookSdkPromise = new Promise<FacebookSdk>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Facebook SDK load timed out.")), 15000);
    const previousInit = window.fbAsyncInit;
    window.fbAsyncInit = () => {
      previousInit?.();
      const sdk = window.FB;
      if (!sdk) {
        window.clearTimeout(timeout);
        reject(new Error("Facebook SDK did not initialize."));
        return;
      }
      try {
        sdk.init({ xfbml: true, version: "v26.0" });
        window.clearTimeout(timeout);
        resolve(sdk);
      } catch (error) {
        window.clearTimeout(timeout);
        reject(error);
      }
    };

    let script = document.getElementById("facebook-jssdk") as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      script.src = "https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v26.0";
      script.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("Facebook SDK could not be loaded."));
      };
      document.head.appendChild(script);
    }
  }).catch((error) => {
    facebookSdkPromise = null;
    throw error;
  });

  return facebookSdkPromise!;
}

function FacebookReelEmbed({ src, title, locale }: { src: string; title: string; locale: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<FacebookVideoPlayer | null>(null);
  const generatedId = useId();
  const playerId = `facebook-video-${generatedId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [ended, setEnded] = useState(false);
  const [sdkUnavailable, setSdkUnavailable] = useState(false);
  const isAr = locale === "ar";
  const sourceUrl = (() => {
    try {
      return new URL(src).searchParams.get("href") ?? "";
    } catch {
      return "";
    }
  })();

  useEffect(() => {
    let active = true;
    let sdk: FacebookSdk | null = null;
    const onPlayerReady = (message: { type?: string; id?: string; instance?: FacebookVideoPlayer }) => {
      if (!active || message.type !== "video" || message.id !== playerId || !message.instance) return;
      playerRef.current = message.instance;
      message.instance.subscribe("finishedPlaying", () => {
        if (active) setEnded(true);
      });
    };

    void loadFacebookSdk().then((loadedSdk) => {
      if (!active || !rootRef.current) return;
      sdk = loadedSdk;
      if (!document.getElementById("fb-root")) {
        const facebookRoot = document.createElement("div");
        facebookRoot.id = "fb-root";
        document.body.prepend(facebookRoot);
      }
      sdk.Event.subscribe("xfbml.ready", onPlayerReady);
      sdk.XFBML.parse(rootRef.current);
    }).catch(() => {
      if (active) setSdkUnavailable(true);
    });

    return () => {
      active = false;
      if (sdk) sdk.Event.unsubscribe?.("xfbml.ready", onPlayerReady);
      playerRef.current = null;
    };
  }, [playerId]);

  const replay = () => {
    const player = playerRef.current;
    if (!player) return;
    try {
      player.seek(0);
      player.play();
      setEnded(false);
    } catch {
      // Keep the replay card visible if Facebook has not accepted the command.
    }
  };

  if (!sourceUrl || sdkUnavailable) {
    return <iframe src={src} title={title} loading="lazy" allow="autoplay; encrypted-media; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" className="absolute inset-0 h-full w-full border-0" />;
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <div ref={rootRef} className="relative z-0 h-full w-full">
        <div
          id={playerId}
          className="fb-video h-full w-full"
          data-href={sourceUrl}
          data-width="420"
          data-show-text="false"
          data-allowfullscreen="true"
        />
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-10 h-14 bg-black" />
      {ended && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-zinc-950/95 px-5 text-center text-white">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10"><Play className="ms-0.5 h-5 w-5 fill-current" /></span>
          <p className="text-sm font-bold">{isAr ? "انتهى الفيديو" : "Vidéo terminée"}</p>
          <button type="button" onClick={replay} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-xs font-bold transition-colors hover:bg-white/20">
            <RotateCcw className="h-3.5 w-3.5" />
            {isAr ? "إعادة المشاهدة" : "Revoir la vidéo"}
          </button>
        </div>
      )}
    </div>
  );
}

export function SocialReelEmbed({
  src,
  originalUrl,
  title,
  platform,
  locale
}: {
  src: string;
  originalUrl: string;
  title: string;
  platform: "tiktok" | "instagram" | "facebook";
  locale: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playWhenReadyRef = useRef(false);
  const playAttemptsRef = useRef(0);
  const playRetryTimerRef = useRef<number | null>(null);
  const [ended, setEnded] = useState(false);
  const [playbackKey, setPlaybackKey] = useState(0);
  const [replayAutoplay, setReplayAutoplay] = useState(false);
  const isAr = locale === "ar";

  useEffect(() => {
    if (platform !== "tiktok") return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== "https://www.tiktok.com" || event.source !== iframeRef.current?.contentWindow) return;
      const payload = event.data as { type?: unknown; value?: unknown; [key: string]: unknown } | null;
      if (payload?.["x-tiktok-player"] !== true) return;

      if (payload.type === "onPlayerReady" && playWhenReadyRef.current && playAttemptsRef.current === 0) {
        const requestPlay = () => {
          if (!playWhenReadyRef.current || playAttemptsRef.current >= 8) return;
          iframeRef.current?.contentWindow?.postMessage(
            { "x-tiktok-player": true, type: "play" },
            "https://www.tiktok.com"
          );
          playAttemptsRef.current += 1;
          playRetryTimerRef.current = window.setTimeout(requestPlay, 350);
        };
        requestPlay();
      }

      if (payload.type === "onStateChange") {
        const state = Number(payload.value);
        if (state === 1) {
          playWhenReadyRef.current = false;
          if (playRetryTimerRef.current !== null) window.clearTimeout(playRetryTimerRef.current);
          playRetryTimerRef.current = null;
        } else if (state === 0) {
          playWhenReadyRef.current = false;
          if (playRetryTimerRef.current !== null) window.clearTimeout(playRetryTimerRef.current);
          playRetryTimerRef.current = null;
          setEnded(true);
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      if (playRetryTimerRef.current !== null) window.clearTimeout(playRetryTimerRef.current);
      playRetryTimerRef.current = null;
    };
  }, [platform, playbackKey]);

  if (platform === "instagram") return <InstagramReelEmbed src={src} url={originalUrl} title={title} />;
  if (platform === "facebook") return <FacebookReelEmbed src={src} title={title} locale={locale} />;

  const replay = () => {
    // Retry the player command until TikTok confirms playback has started.
    playWhenReadyRef.current = true;
    playAttemptsRef.current = 0;
    setReplayAutoplay(true);
    setEnded(false);
    setPlaybackKey((key) => key + 1);
  };

  return (
    <div className="absolute inset-0 bg-black">
      {!ended ? (
        <iframe
          key={playbackKey}
          ref={iframeRef}
          src={replayAutoplay ? `${src}&autoplay=1` : src}
          title={title}
          loading="lazy"
          allow="autoplay; encrypted-media; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950 px-5 text-center text-white">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white">
            <Play className="ms-0.5 h-5 w-5 fill-current" />
          </span>
          <p className="text-sm font-bold">{isAr ? "انتهى الفيديو" : "Vidéo terminée"}</p>
          <button type="button" onClick={replay} className="inline-flex min-h-9 items-center gap-2 rounded-full bg-white/10 px-4 text-xs font-bold transition-colors hover:bg-white/20">
            <RotateCcw className="h-3.5 w-3.5" />
            {isAr ? "إعادة المشاهدة" : "Revoir la vidéo"}
          </button>
        </div>
      )}
    </div>
  );
}
