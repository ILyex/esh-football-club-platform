"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft, ArrowRight, Bell, BookOpen, Check, ChevronLeft,
  ChevronRight, CircleDollarSign, Expand, Goal, Layers3, Play, ShieldCheck,
  Trophy, Users, X
} from "lucide-react";

type Locale = "ar" | "fr";
type Slide = { eyebrow: string; title: string; body: string; href: string; Icon: typeof Trophy; tag: string };

const copy = {
  ar: {
    club: "الجمعية الرياضية أمل سيدي حسني لكرة القدم",
    launch: "الإطلاق الرسمي",
    headline: "لحظات قليلة… ونبدأ معاً",
    subline: "منصة النادي، بكل تفاصيلها، أمامكم الآن.",
    days: "يوم", hours: "ساعة", minutes: "دقيقة", seconds: "ثانية",
    mark: "استعدوا لاكتشاف تجربة النادي الجديدة",
    scan: "امسح لفتح الموقع",
    revealed: "انطلق الموقع الرسمي",
    revealBody: "بوابة واحدة تجمع أخبار النادي، لاعبيه، مبارياته، وإدارته.",
    start: "ابدأ جولة المزايا", openSite: "فتح الموقع الرسمي", fullscreen: "ملء الشاشة",
    openFeature: "استعراض هذا القسم",
    skip: "تجاوز العرض", previous: "السابق", next: "التالي", finish: "العودة للموقع",
    slide: "المحطة", install: "عرض الإطلاق",
    slides: [
      { eyebrow: "01 · بوابة النادي", title: "كل النادي في مكان واحد", body: "واجهة رسمية تجمع آخر الأخبار، الإعلانات، الصور، والروابط التي يحتاجها الجمهور." , href: "/", Icon: Layers3, tag: "الرؤية الرسمية" },
      { eyebrow: "02 · الفرق واللاعبون", title: "قريبون من كل فئة", body: "تعرّفوا على الفئات، قوائم اللاعبين، الملفات الرياضية، ونتائجهم في مساحة منظمة." , href: "/team", Icon: Users, tag: "الفئات واللاعبون" },
      { eyebrow: "03 · المباريات", title: "المباراة لحظة بلحظة", body: "مواعيد ونتائج المباريات، تفاصيل اللقاء، والأحداث التي تصنع حكاية كل مواجهة." , href: "/matches", Icon: Goal, tag: "المباريات والنتائج" },
      { eyebrow: "04 · المنافسات", title: "طريق الفريق في البطولة", body: "تابعوا المنافسات والترتيب والنتائج في عرض واضح يضع رحلة النادي في الصورة." , href: "/competitions", Icon: Trophy, tag: "المنافسات" },
      { eyebrow: "05 · أخبار النادي", title: "قصص النادي أولاً بأول", body: "أخبار، إعلانات، ومعرض يوثق التدريبات والمباريات واللحظات التي تجمعنا." , href: "/news", Icon: BookOpen, tag: "الأخبار والمكتبة" },
      { eyebrow: "06 · إدارة متكاملة", title: "إدارة منظمة من الداخل", body: "منصة موحدة تساعد الطاقم على تنسيق التدريبات والوثائق والمالية والعتاد." , href: "/platform", Icon: CircleDollarSign, tag: "بوابة المنصة" },
      { eyebrow: "07 · نبقى على تواصل", title: "أحداث النادي تصل إليكم", body: "فعّلوا إشعارات المباريات لتصلكم البداية والأهداف والنهاية حتى عندما تغلقون الموقع." , href: "/matches", Icon: Bell, tag: "إشعارات المباريات" }
    ]
  },
  fr: {
    club: "Association Sportive Espoir Sidi Hosni de Football",
    launch: "LANCEMENT OFFICIEL",
    headline: "Plus que quelques instants…",
    subline: "La plateforme du club s’ouvre bientôt à vous.",
    days: "Jours", hours: "Heures", minutes: "Minutes", seconds: "Secondes",
    mark: "Préparez-vous à découvrir la nouvelle expérience du club",
    scan: "Scannez pour ouvrir le site",
    revealed: "Le site officiel est lancé",
    revealBody: "Une plateforme unique pour suivre le club, ses équipes, ses matchs et son actualité.",
    start: "Découvrir les fonctionnalités", openSite: "Ouvrir le site officiel", fullscreen: "Plein écran",
    openFeature: "Voir cette rubrique",
    skip: "Passer la présentation", previous: "Précédent", next: "Suivant", finish: "Retour au site",
    slide: "Étape", install: "Lancement officiel",
    slides: [
      { eyebrow: "01 · LE CLUB", title: "Le club, au même endroit", body: "Actualités, annonces, galerie photo et informations utiles dans une vitrine officielle.", href: "/", Icon: Layers3, tag: "Vitrine officielle" },
      { eyebrow: "02 · ÉQUIPES ET JOUEURS", title: "Au plus près de chaque équipe", body: "Découvrez les catégories, les effectifs et les profils sportifs dans un espace organisé.", href: "/team", Icon: Users, tag: "Équipes et joueurs" },
      { eyebrow: "03 · MATCHS", title: "Le match, en direct", body: "Calendrier, résultats, détails des rencontres et événements qui rythment chaque match.", href: "/matches", Icon: Goal, tag: "Matchs et résultats" },
      { eyebrow: "04 · COMPÉTITIONS", title: "Le parcours en championnat", body: "Suivez les compétitions, le classement et les résultats du club en un coup d’œil.", href: "/competitions", Icon: Trophy, tag: "Compétitions" },
      { eyebrow: "05 · ACTUALITÉS", title: "Les histoires du club", body: "Actualités, annonces et galerie pour revivre les entraînements, les matchs et les moments forts.", href: "/news", Icon: BookOpen, tag: "Actualités et médias" },
      { eyebrow: "06 · GESTION", title: "Une organisation unifiée", body: "Une plateforme pour coordonner les entraînements, les documents, les finances et le matériel.", href: "/platform", Icon: CircleDollarSign, tag: "Portail de gestion" },
      { eyebrow: "07 · RESTONS CONNECTÉS", title: "Le club vous tient informés", body: "Activez les notifications pour recevoir le coup d’envoi, les buts et le résultat final.", href: "/matches", Icon: Bell, tag: "Notifications des matchs" }
    ]
  }
} satisfies Record<Locale, {
  [key: string]: unknown;
  slides: Slide[];
}>;

function CountdownUnit({ value, label, index }: { value: string; label: string; index: number }) {
  return <div className="launch-countdown-unit group relative flex min-w-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-[1.15rem] border border-white/[.12] bg-[#171416]/90 px-2 py-3 shadow-[0_16px_44px_rgba(0,0,0,.28),inset_0_1px_0_rgba(255,255,255,.07)] backdrop-blur-xl sm:min-w-[118px] sm:rounded-[1.45rem] sm:px-5 sm:py-4">
    <span className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-red-300/55 to-transparent" aria-hidden="true" />
    <span className="absolute -right-8 -top-10 h-20 w-20 rounded-full bg-red-500/[.08] blur-2xl transition group-hover:bg-red-500/[.14]" aria-hidden="true" />
    <span className="absolute start-3 top-3 font-mono text-[8px] font-bold tracking-[.18em] text-white/20 sm:start-4 sm:top-4">0{index + 1}</span>
    <span key={value} className="launch-countdown-value relative font-mono text-[2.6rem] font-bold leading-none tracking-[-.07em] text-white tabular-nums drop-shadow-[0_2px_16px_rgba(255,255,255,.12)] sm:text-6xl">{value}</span>
    <span className="relative mt-2 text-[9px] font-bold tracking-[.12em] text-white/45 sm:mt-3 sm:text-[11px]">{label}</span>
  </div>;
}

export function LaunchExperience({ locale, launchAt, publicSiteUrl }: { locale: string; launchAt: string | null; publicSiteUrl: string }) {
  const lang: Locale = locale === "fr" ? "fr" : "ar";
  const isAr = lang === "ar";
  const t = copy[lang];
  const siteHref = `/${lang}`;
  const target = launchAt ? Date.parse(launchAt) : 0;
  const [now, setNow] = useState(0);
  const [started, setStarted] = useState(false);
  const [showLaunchScene, setShowLaunchScene] = useState(false);
  const [sceneSeconds, setSceneSeconds] = useState(30);
  const [previewMode] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("preview") === "1");
  const [slideIndex, setSlideIndex] = useState(0);
  const live = now >= target;
  const currentSlide = t.slides[slideIndex] ?? t.slides[0]!;
  const confetti = useMemo(() => Array.from({ length: 72 }, (_, index) => ({
    left: `${(index * 47 + 7) % 100}%`,
    delay: `${(index % 18) * -0.19}s`,
    duration: `${4.4 + (index % 13) * 0.31}s`,
    hue: [0, 46, 154, 355][index % 4],
    size: `${5 + index % 7}px`
  })), []);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!live || started || showLaunchScene) return;
    const timer = window.setTimeout(() => { setSlideIndex(0); setStarted(true); }, 7_000);
    return () => window.clearTimeout(timer);
  }, [live, started, showLaunchScene]);

  useEffect(() => {
    if (!live || showLaunchScene || started) return;
    setShowLaunchScene(true);
    setSceneSeconds(30);
  }, [live, showLaunchScene, started]);

  useEffect(() => {
    if (!showLaunchScene || previewMode) return;
    const timer = window.setInterval(() => setSceneSeconds((seconds) => Math.max(0, seconds - 1)), 1_000);
    const finish = window.setTimeout(() => { window.location.assign(siteHref); }, 30_000);
    return () => { window.clearInterval(timer); window.clearTimeout(finish); };
  }, [showLaunchScene, previewMode, siteHref]);

  useEffect(() => {
    if (!started) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") setSlideIndex((i) => Math.min(t.slides.length - 1, i + (isAr ? -1 : 1)));
      if (event.key === "ArrowLeft") setSlideIndex((i) => Math.min(t.slides.length - 1, i + (isAr ? 1 : -1)));
      if (event.key === "Escape") setStarted(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [started, t.slides.length, isAr]);

  const remaining = Math.max(0, target - now);
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining / 3_600_000) % 24);
  const minutes = Math.floor((remaining / 60_000) % 60);
  const seconds = Math.floor((remaining / 1000) % 60);
  const count = (n: number) => String(n).padStart(2, "0");

  async function enterFullscreen() {
    try { await document.documentElement.requestFullscreen?.(); } catch { /* Full-screen may require a user gesture or be unsupported. */ }
  }

  const Arrow = isAr ? ArrowLeft : ArrowRight;
  return <main dir={isAr ? "rtl" : "ltr"} lang={lang} className="fixed inset-0 z-[100] overflow-hidden bg-[#090a0b] text-white selection:bg-red-500/40">
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(189,20,40,.20),transparent_44%),radial-gradient(ellipse_at_8%_100%,rgba(118,17,28,.22),transparent_38%)]" />
    <div className="absolute -top-48 start-[12%] h-[30rem] w-[30rem] rounded-full border border-white/[0.035]" />
    <div className="absolute -top-24 start-[17%] h-[24rem] w-[24rem] rounded-full border border-white/[0.035]" />
    <div className="absolute -bottom-64 end-[-5rem] h-[38rem] w-[38rem] rounded-full border border-red-500/[0.09]" />
    {live && !started && !showLaunchScene && <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">{confetti.map((piece, index) => <i key={index} className="launch-confetti" style={{ left: piece.left, animationDelay: piece.delay, animationDuration: piece.duration, backgroundColor: `hsl(${piece.hue} 88% 61%)`, width: piece.size, height: `${Number.parseInt(piece.size) * 1.45}px` } as CSSProperties} />)}</div>}

    <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-10 sm:py-7">
      <div className="flex min-w-0 items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/branding/esh-logo-128.png" alt="ESH" className="h-10 w-10 object-contain sm:h-12 sm:w-12" />
        <p className="max-w-[min(58vw,28rem)] text-[11px] font-bold leading-snug text-white/85 sm:text-sm sm:leading-relaxed">{t.club}</p>
      </div>
      <div className="flex items-center gap-2">
        {!started && <span className="rounded-full border border-red-400/20 bg-red-500/[0.08] px-3 py-1.5 text-[10px] font-bold tracking-[.12em] text-red-300 sm:text-xs">{t.launch}</span>}
        {started && <button onClick={() => setStarted(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/10" aria-label={t.skip}><X className="h-4 w-4" /></button>}
      </div>
    </header>

    <aside className="absolute bottom-4 end-4 z-20 flex items-center gap-2 rounded-2xl border border-white/10 bg-[#111214]/90 p-2 shadow-[0_14px_50px_rgba(0,0,0,.4)] backdrop-blur-xl sm:bottom-7 sm:end-8 sm:gap-3 sm:p-3" aria-label={t.scan}>
      <div className="rounded-lg bg-white p-1.5 sm:rounded-xl sm:p-2">
        <QRCodeSVG value={publicSiteUrl} size={72} level="M" bgColor="#ffffff" fgColor="#101114" title={t.scan} />
      </div>
      <div className="max-w-[92px] text-start sm:max-w-none">
        <p className="text-[9px] font-black leading-relaxed text-white/85 sm:text-xs">{t.scan}</p>
        <p className="mt-1 hidden max-w-48 truncate font-mono text-[9px] text-white/35 sm:block">{new URL(publicSiteUrl).host}</p>
      </div>
    </aside>

    {showLaunchScene && <div className="launch-sky fixed inset-0 z-[120] overflow-hidden" role="status" aria-label="ESH2026"
      onPointerMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width - 0.5;
        const y = (event.clientY - bounds.top) / bounds.height - 0.5;
        event.currentTarget.style.setProperty("--pointer-x", String(x));
        event.currentTarget.style.setProperty("--pointer-y", String(y));
        event.currentTarget.style.setProperty("--tilt-x", `${-y * 5}deg`);
        event.currentTarget.style.setProperty("--tilt-y", `${x * 7}deg`);
      }}
      onPointerLeave={(event) => {
        event.currentTarget.style.setProperty("--pointer-x", "0");
        event.currentTarget.style.setProperty("--pointer-y", "0");
        event.currentTarget.style.setProperty("--tilt-x", "0deg");
        event.currentTarget.style.setProperty("--tilt-y", "0deg");
      }}>
      <iframe src={siteHref} title="ESH official website in the background" className="launch-site-backdrop absolute inset-0 h-full w-full border-0" tabIndex={-1} aria-hidden="true" />
      <div className="launch-scene-dimmer absolute inset-0" aria-hidden="true" />
      <div className="launch-sky-haze absolute inset-0" aria-hidden="true" />
      <div className="launch-sky-stars absolute inset-0" aria-hidden="true" />
      <div className="launch-sky-milkyway absolute inset-0" aria-hidden="true" />
      <div className="launch-light-beam absolute inset-0" aria-hidden="true" />
      <div className="launch-horizon-glow absolute inset-x-0 bottom-[18vh]" aria-hidden="true" />
      <div className="launch-sky-orbit launch-sky-orbit-a" aria-hidden="true" />
      <div className="launch-sky-orbit launch-sky-orbit-b" aria-hidden="true" />
      <div className="launch-shooting-star launch-shooting-star-a" aria-hidden="true" />
      <div className="launch-shooting-star launch-shooting-star-b" aria-hidden="true" />
      <div className="launch-firework launch-firework-left" aria-hidden="true" />
      <div className="launch-firework launch-firework-right" aria-hidden="true" />
      <div className="launch-firework launch-firework-back" aria-hidden="true" />
      <div className="launch-stadium absolute inset-x-0 bottom-0 h-[25vh] min-h-36" aria-hidden="true" />
      <div className="launch-skyline-lights absolute inset-x-0 bottom-[12vh]" aria-hidden="true" />
      <div className="launch-drone-flight launch-drone-a" aria-hidden="true"><i /><b /></div>
      <div className="launch-drone-flight launch-drone-b" aria-hidden="true"><i /><b /></div>
      <div className="launch-drone-flight launch-drone-c" aria-hidden="true"><i /><b /></div>
      <div className="launch-drone-flight launch-drone-d" aria-hidden="true"><i /><b /></div>
        <div className="launch-sky-composition absolute inset-x-0 top-[6vh] bottom-[17vh] flex flex-col items-center justify-center px-3">
        <div className="launch-crest-wrap mb-3 flex h-12 w-12 items-center justify-center rounded-full sm:mb-4 sm:h-14 sm:w-14">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/branding/esh-logo-128.png" alt="ESH" className="h-10 w-10 object-contain sm:h-14 sm:w-14" />
        </div>
        <p className="mb-0 text-[9px] font-black tracking-[.5em] text-red-100/75 sm:mb-1 sm:text-xs">LANCEMENT OFFICIEL · 2026</p>
        <div className="launch-mark-perspective w-[94vw] max-w-[1440px]">
        <svg className="launch-drone-mark w-full overflow-visible" viewBox="0 0 1200 400" role="img" aria-label="ESH2026">
          <defs>
            <radialGradient id="esh-drone-light"><stop offset="0" stopColor="#fff4f5" /><stop offset=".16" stopColor="#ffb8c2" /><stop offset=".46" stopColor="#ff3156" /><stop offset="1" stopColor="#ff173f" stopOpacity=".58" /></radialGradient>
            <pattern id="esh-drone-dots" width="10" height="10" patternUnits="userSpaceOnUse">
              <circle cx="5" cy="5" r="4.2" fill="#ff173f" opacity=".22" />
              <circle cx="5" cy="5" r="2.25" fill="url(#esh-drone-light)" />
              <circle cx="5" cy="5" r=".8" fill="#fff" opacity=".96" />
            </pattern>
            <mask id="esh-drone-text-mask"><rect width="1200" height="400" fill="black" /><text x="600" y="278" textAnchor="middle" textLength="1040" lengthAdjust="spacingAndGlyphs" fontFamily="Arial, sans-serif" fontSize="232" fontWeight="900" letterSpacing="5" fill="white">ESH2026</text></mask>
            <filter id="esh-drone-glow" x="-30%" y="-60%" width="160%" height="220%" colorInterpolationFilters="sRGB"><feGaussianBlur in="SourceGraphic" stdDeviation="3.2" result="softGlow" /><feGaussianBlur in="SourceGraphic" stdDeviation=".8" result="tightGlow" /><feMerge><feMergeNode in="softGlow" /><feMergeNode in="tightGlow" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          <g className="launch-drone-lights" filter="url(#esh-drone-glow)">
            <g mask="url(#esh-drone-text-mask)" transform="translate(0 20)" opacity=".13"><rect width="1200" height="400" fill="url(#esh-drone-dots)" /></g>
            <g mask="url(#esh-drone-text-mask)" transform="translate(0 12)" opacity=".18"><rect width="1200" height="400" fill="url(#esh-drone-dots)" /></g>
            <g mask="url(#esh-drone-text-mask)" transform="translate(0 5)" opacity=".24"><rect width="1200" height="400" fill="url(#esh-drone-dots)" /></g>
            <rect width="1200" height="400" fill="url(#esh-drone-dots)" mask="url(#esh-drone-text-mask)" />
          </g>
        </svg>
        </div>
        <p className="mt-2 text-[10px] font-bold tracking-[.22em] text-white/75 sm:mt-4 sm:text-sm">{isAr ? "أمل سيدي حسني · الإطلاق الرسمي" : "ESPOIR SIDI HOSNI · LANCEMENT OFFICIEL"}</p>
      </div>
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-red-300/20 bg-black/35 px-3 py-1.5 font-mono text-[10px] text-red-100/75 backdrop-blur"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />00:{String(sceneSeconds).padStart(2, "0")}</div>
    </div>}

    {!started && !live && <section className="relative z-10 mx-auto flex h-[calc(100dvh-92px)] max-w-6xl flex-col items-center justify-center px-4 pb-12 text-center sm:h-[calc(100dvh-112px)]">
      <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-xs font-semibold text-white/65 shadow-lg shadow-black/20">
        <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" /></span>
        {t.mark}
      </div>
      <h1 className="max-w-4xl text-balance text-4xl font-black leading-[1.2] tracking-tight sm:text-6xl lg:text-7xl">{t.headline}</h1>
      <p className="mt-5 max-w-2xl text-sm leading-7 text-white/55 sm:text-lg">{t.subline}</p>
      <div className="launch-countdown-shell mt-9 flex w-full max-w-[760px] items-stretch gap-1.5 rounded-[1.65rem] border border-white/[.08] bg-black/20 p-2.5 shadow-[0_28px_90px_rgba(0,0,0,.24)] sm:mt-12 sm:gap-3 sm:rounded-[2rem] sm:p-4">
        {days > 0 && <><CountdownUnit value={count(days)} label={t.days} index={0} /><span className="launch-countdown-separator">:</span></>}
        <CountdownUnit value={count(hours)} label={t.hours} index={days > 0 ? 1 : 0} /><span className="launch-countdown-separator">:</span>
        <CountdownUnit value={count(minutes)} label={t.minutes} index={days > 0 ? 2 : 1} /><span className="launch-countdown-separator">:</span>
        <CountdownUnit value={count(seconds)} label={t.seconds} index={days > 0 ? 3 : 2} />
      </div>
      <div className="mt-9 h-px w-28 bg-gradient-to-r from-transparent via-red-400/60 to-transparent" />
      <button onClick={enterFullscreen} className="mt-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-white/45 transition hover:bg-white/5 hover:text-white/80"><Expand className="h-3.5 w-3.5" />{t.fullscreen}</button>
      <p className="absolute bottom-5 text-[10px] font-medium tracking-[.24em] text-white/25">SIDI HOSNI · ALGÉRIE</p>
    </section>}

    {!started && live && <section className="relative z-10 mx-auto flex h-[calc(100dvh-92px)] max-w-5xl flex-col items-center justify-center px-5 pb-12 text-center sm:h-[calc(100dvh-112px)]">
      <div className="mb-7 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-300/25 bg-emerald-300/10 text-emerald-300 shadow-[0_0_70px_rgba(52,211,153,.15)]"><Check className="h-8 w-8" strokeWidth={2.4} /></div>
      <p className="mb-3 text-xs font-black uppercase tracking-[.24em] text-emerald-300">{t.launch}</p>
      <h1 className="text-balance text-4xl font-black tracking-tight sm:text-6xl">{t.revealed}</h1>
      <p className="mt-5 max-w-2xl text-sm leading-7 text-white/60 sm:text-lg">{t.revealBody}</p>
      <div className="mt-9 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
        <button onClick={() => { setSlideIndex(0); setStarted(true); }} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-600 px-6 text-sm font-bold shadow-[0_10px_40px_rgba(220,38,38,.25)] transition hover:bg-red-500"><Play className="h-4 w-4" fill="currentColor" />{t.start}</button>
        <Link href={siteHref} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-6 text-sm font-bold text-white/80 transition hover:bg-white/[0.08]">{t.openSite}<Arrow className="h-4 w-4" /></Link>
      </div>
      <p className="mt-5 text-xs text-white/35">{isAr ? "سيبدأ العرض بعد لحظات" : "La présentation commence dans quelques instants"}</p>
    </section>}

    {started && <section className="relative z-10 mx-auto flex h-[calc(100dvh-100px)] max-w-7xl flex-col justify-center px-5 pb-5 sm:h-[calc(100dvh-112px)] sm:px-12 lg:px-20">
      <div className="grid items-center gap-7 lg:grid-cols-[1fr_.9fr] lg:gap-20">
        <div key={slideIndex} className="launch-slide-in">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-400/20 bg-red-500/[0.07] px-3.5 py-2 text-[10px] font-black tracking-[.18em] text-red-300 sm:text-xs"><span className="h-1.5 w-1.5 rounded-full bg-red-400" />{currentSlide.eyebrow}</div>
          <h1 className="max-w-3xl text-balance text-4xl font-black leading-[1.2] tracking-tight sm:text-6xl xl:text-7xl">{currentSlide.title}</h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-white/60 sm:mt-7 sm:text-lg sm:leading-8">{currentSlide.body}</p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-white/42"><ShieldCheck className="h-4 w-4 text-emerald-300" />{currentSlide.tag}</div>
            <Link href={`/${lang}${currentSlide.href}`} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-bold text-white/75 transition hover:border-red-300/30 hover:bg-white/[.07] hover:text-white">{t.openFeature}<Arrow className="h-3.5 w-3.5" /></Link>
          </div>
        </div>
        <div key={`visual-${slideIndex}`} className="launch-slide-in relative mx-auto flex aspect-[1.15/1] w-full max-w-[560px] items-center justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,.065),rgba(255,255,255,.015))] shadow-[0_35px_100px_rgba(0,0,0,.36)]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(220,38,38,.20),transparent_55%)]" />
          <div className="absolute inset-[9%] rounded-[1.6rem] border border-white/[.055]" />
          <div className="absolute start-[14%] top-[16%] h-24 w-24 rounded-full border border-red-300/20" />
          <div className="absolute bottom-[13%] end-[12%] h-36 w-36 rounded-full border border-white/[.07]" />
          <div className="relative flex h-36 w-36 items-center justify-center rounded-[2rem] border border-red-300/25 bg-[#171012] text-red-300 shadow-[0_0_90px_rgba(220,38,38,.16)] sm:h-48 sm:w-48 sm:rounded-[2.5rem]">
            <currentSlide.Icon className="h-16 w-16 sm:h-24 sm:w-24" strokeWidth={1.15} />
            <div className="absolute -bottom-5 -end-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-[#111214] text-white/60"><span className="font-mono text-sm font-bold">0{slideIndex + 1}</span></div>
          </div>
          <div className="absolute bottom-6 start-6 text-[10px] font-bold tracking-[.24em] text-white/25">ESH · 2026</div>
        </div>
      </div>
      <div className="mt-8 flex flex-col gap-4 border-t border-white/10 pt-5 sm:mt-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-5 sm:justify-start">
          <div className="flex items-center gap-1.5" aria-label={`${t.slide} ${slideIndex + 1} / ${t.slides.length}`}>{t.slides.map((_, i) => <span key={i} className={`h-1 rounded-full transition-all ${i === slideIndex ? "w-8 bg-red-400" : "w-2 bg-white/20"}`} />)}</div>
          <span className="font-mono text-xs text-white/40">{String(slideIndex + 1).padStart(2, "0")} <span className="text-white/20">/</span> {String(t.slides.length).padStart(2, "0")}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href={siteHref} className="me-auto inline-flex h-10 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-white/55 transition hover:bg-white/5 hover:text-white sm:me-4">{t.openSite}<Arrow className="h-3.5 w-3.5" /></Link>
          <button onClick={() => setSlideIndex((i) => Math.max(0, i - 1))} disabled={slideIndex === 0} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-semibold text-white/75 transition hover:bg-white/5 disabled:opacity-30"><ChevronLeft className="h-4 w-4" />{t.previous}</button>
          {slideIndex < t.slides.length - 1
            ? <button onClick={() => setSlideIndex((i) => Math.min(t.slides.length - 1, i + 1))} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-red-600 px-4 text-xs font-bold text-white transition hover:bg-red-500">{t.next}<ChevronRight className="h-4 w-4" /></button>
            : <Link href={siteHref} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-red-600 px-4 text-xs font-bold text-white transition hover:bg-red-500">{t.finish}<Arrow className="h-4 w-4" /></Link>}
        </div>
      </div>
    </section>}

    <style>{`
      @keyframes esh-confetti-fall { 0% { transform: translate3d(0,-12vh,0) rotate(0deg); opacity:0 } 8% {opacity:1} 88% {opacity:.9} 100% { transform: translate3d(var(--drift,22px),112vh,0) rotate(760deg); opacity:0 } }
      @keyframes esh-slide-in { from { opacity:0; transform:translateY(16px) scale(.99) } to { opacity:1; transform:translateY(0) scale(1) } }
      .launch-confetti { position:absolute; top:-20px; border-radius:2px; opacity:0; animation-name:esh-confetti-fall; animation-timing-function:cubic-bezier(.15,.56,.44,.98); animation-iteration-count:1; }
      .launch-confetti:nth-child(3n) { --drift:-45px; border-radius:50% }
      .launch-confetti:nth-child(3n + 1) { --drift:48px }
      .launch-slide-in { animation:esh-slide-in .55s cubic-bezier(.2,.7,.2,1) both }
      @keyframes esh-countdown-tick { 0% { opacity:.3; transform:translateY(5px) scale(.97); filter:blur(2px) } 100% { opacity:1; transform:translateY(0) scale(1); filter:blur(0) } }
      .launch-countdown-value { animation:esh-countdown-tick .32s cubic-bezier(.2,.75,.25,1) both }
      .launch-countdown-separator { display:flex; align-items:center; justify-content:center; flex:0 0 7px; padding-bottom:1.25rem; color:rgba(252,165,165,.56); font-family:ui-monospace,monospace; font-size:1.15rem; font-weight:700; text-shadow:0 0 18px rgba(248,113,113,.25) }
      @media (min-width:640px) { .launch-countdown-separator { flex-basis:14px; padding-bottom:1.65rem; font-size:1.6rem } }
      .launch-sky { background:radial-gradient(ellipse at 50% 43%,#211321 0%,#11101a 39%,#070911 70%,#03050b 100%); isolation:isolate }
      .launch-site-backdrop { z-index:0; opacity:.2; filter:blur(2px) saturate(.55) brightness(.6); transform:scale(1.045); pointer-events:none }
      .launch-scene-dimmer { z-index:1; background:linear-gradient(180deg,rgba(5,5,11,.68),rgba(8,5,12,.48) 43%,rgba(3,4,9,.82)),radial-gradient(ellipse at 50% 42%,rgba(107,8,30,.24),transparent 63%) }
      .launch-sky-haze,.launch-sky-stars,.launch-sky-milkyway,.launch-light-beam { position:absolute; z-index:2; pointer-events:none }
      .launch-sky-haze { background:radial-gradient(ellipse at 50% 70%,rgba(134,13,40,.27),transparent 46%),radial-gradient(ellipse at 18% 35%,rgba(45,42,84,.25),transparent 38%),radial-gradient(ellipse at 82% 45%,rgba(76,31,53,.22),transparent 38%),linear-gradient(180deg,rgba(2,4,12,.05),transparent 48%,rgba(2,3,8,.48)); animation:esh-haze-breathe 8s ease-in-out infinite alternate }
      .launch-sky-stars { background-image:radial-gradient(1px 1px at 12% 18%,rgba(255,255,255,.82),transparent 1.5px),radial-gradient(1px 1px at 31% 42%,rgba(255,190,198,.7),transparent 1.5px),radial-gradient(1.5px 1.5px at 68% 20%,rgba(255,255,255,.8),transparent 2px),radial-gradient(1px 1px at 84% 48%,rgba(255,150,165,.75),transparent 1.5px),radial-gradient(1px 1px at 53% 68%,rgba(255,255,255,.55),transparent 1.5px); background-size:230px 190px,310px 260px,370px 290px,280px 220px,420px 330px; animation:esh-stars-drift 22s linear infinite }
      .launch-sky-milkyway { opacity:.34; background:linear-gradient(154deg,transparent 20%,rgba(132,107,145,.11) 35%,rgba(250,205,214,.12) 43%,rgba(126,83,118,.08) 50%,transparent 67%); filter:blur(16px); transform:translate3d(calc(var(--pointer-x,0)*-12px),calc(var(--pointer-y,0)*-8px),0) rotate(-6deg) scale(1.3) }
      .launch-light-beam { opacity:.52; background:linear-gradient(164deg,transparent 0 37%,rgba(255,47,77,.1) 46%,transparent 59%),linear-gradient(196deg,transparent 0 40%,rgba(255,47,77,.08) 49%,transparent 62%); filter:blur(26px); mix-blend-mode:screen; mask-image:linear-gradient(180deg,#000 12%,transparent 78%) }
      .launch-horizon-glow { z-index:3; height:22vh; background:radial-gradient(ellipse at 50% 100%,rgba(186,15,44,.28),rgba(82,14,33,.12) 35%,transparent 72%); filter:blur(22px); pointer-events:none }
      .launch-sky-orbit { position:absolute; left:50%; top:43%; width:min(82vw,1120px); height:min(30vw,390px); border:1px solid rgba(255,118,143,.08); border-radius:50%; transform:translate(-50%,-50%) rotateX(72deg) rotateZ(-8deg); box-shadow:0 0 36px rgba(255,29,67,.055),inset 0 0 36px rgba(255,29,67,.035); pointer-events:none }
      .launch-sky-orbit-a { animation:esh-orbit-a 22s linear infinite }
      .launch-sky-orbit-b { width:min(70vw,940px); height:min(25vw,300px); border-color:rgba(174,162,195,.08); transform:translate(-50%,-50%) rotateX(68deg) rotateZ(12deg); animation:esh-orbit-b 26s linear infinite }
      .launch-shooting-star { position:absolute; z-index:1; width:110px; height:1px; opacity:0; background:linear-gradient(90deg,transparent,rgba(255,225,231,.95),rgba(255,52,87,.6),transparent); box-shadow:0 0 8px rgba(255,82,109,.8); transform:rotate(-30deg); animation:esh-shooting-star 5.5s ease-in infinite }
      .launch-shooting-star-a { top:16%; left:21%; animation-delay:.5s }
      .launch-shooting-star-b { top:28%; right:17%; animation-delay:3.2s; transform:rotate(-22deg) scale(.7) }
      .launch-stadium { z-index:3; background:linear-gradient(180deg,transparent,rgba(7,7,10,.02) 18%,rgba(8,7,12,.92)),linear-gradient(0deg,rgba(178,9,33,.34),transparent 72%); clip-path:polygon(0 58%,8% 50%,17% 58%,25% 45%,34% 57%,44% 42%,50% 52%,58% 40%,67% 55%,76% 43%,84% 56%,92% 45%,100% 55%,100% 100%,0 100%); border-top:1px solid rgba(255,75,95,.52); box-shadow:0 -10px 70px rgba(220,20,50,.26) }
      .launch-stadium::after { content:""; position:absolute; inset:28% 0 auto; height:2px; background:repeating-linear-gradient(90deg,rgba(255,80,106,.8) 0 2px,transparent 2px 20px); filter:blur(2px); box-shadow:0 0 22px rgba(255,45,75,.55) }
      .launch-skyline-lights { z-index:4; height:2px; background:repeating-linear-gradient(90deg,transparent 0 3%,rgba(255,177,139,.65) 3.1% 3.3%,transparent 3.4% 4.1%,rgba(255,58,86,.7) 4.2% 4.35%,transparent 4.5% 6%); filter:blur(2px); box-shadow:0 0 16px rgba(255,53,82,.4) }
      .launch-sky-composition { z-index:5; transform:translate3d(calc(var(--pointer-x,0)*-9px),calc(-3vh + var(--pointer-y,0)*-6px),0); transition:transform .25s ease-out }
      .launch-mark-perspective { perspective:1000px; transform-style:preserve-3d; filter:drop-shadow(0 36px 28px rgba(0,0,0,.72)); transform:rotateX(var(--tilt-x,0deg)) rotateY(var(--tilt-y,0deg)); transition:transform .22s ease-out }
      .launch-drone-mark { animation:esh-mark-arrive 2s cubic-bezier(.16,.8,.25,1) both; transform:rotateX(15deg) rotateY(-2deg) rotateZ(-.6deg) translateZ(0) scale(1); transform-origin:center 55%; filter:drop-shadow(0 0 22px rgba(255,20,55,.8)) drop-shadow(0 12px 20px rgba(140,5,30,.48)) }
      .launch-drone-lights { opacity:.98; animation:esh-drone-shimmer 5.8s ease-in-out infinite alternate }
      .launch-crest-wrap { border:1px solid rgba(255,90,110,.38); background:radial-gradient(circle,rgba(255,42,77,.24),rgba(10,8,14,.55) 68%); box-shadow:0 0 35px rgba(255,20,54,.22),inset 0 0 20px rgba(255,20,54,.12); animation:esh-crest-float 4s ease-in-out infinite }
      .launch-firework { position:absolute; z-index:2; width:clamp(130px,21vw,340px); aspect-ratio:1; border-radius:50%; background:repeating-conic-gradient(from 4deg,rgba(255,44,77,.95) 0deg 1deg,transparent 1.2deg 10deg,rgba(255,195,145,.75) 10.4deg 11deg,transparent 11.4deg 18deg); -webkit-mask-image:radial-gradient(circle,transparent 0 10%,#000 19%,transparent 67%); mask-image:radial-gradient(circle,transparent 0 10%,#000 19%,transparent 67%); filter:drop-shadow(0 0 9px rgba(255,31,63,.85)); animation:esh-firework 3.4s ease-out infinite }
      .launch-firework::before,.launch-firework::after { content:""; position:absolute; inset:18%; border:1px solid rgba(255,91,111,.7); border-radius:50%; box-shadow:0 0 16px rgba(255,30,60,.5),inset 0 0 14px rgba(255,30,60,.28) }
      .launch-firework::after { inset:34%; border-color:rgba(255,210,175,.75); transform:rotate(25deg) }
      .launch-firework-left { left:4%; top:16%; animation-delay:.2s }
      .launch-firework-right { right:4%; top:20%; transform:scale(.8); animation-delay:1.5s }
      .launch-firework-back { left:49%; top:8%; width:clamp(90px,13vw,190px); opacity:.54; animation-delay:2.2s }
      .launch-drone-flight { position:absolute; z-index:4; width:24px; height:18px; animation:esh-drone-flight 8s ease-in-out infinite; transform-style:preserve-3d; filter:drop-shadow(0 5px 4px rgba(0,0,0,.65)) }
      .launch-drone-flight::before,.launch-drone-flight::after { content:""; position:absolute; left:50%; top:50%; width:28px; height:1px; background:linear-gradient(90deg,transparent,rgba(255,100,122,.9),transparent); transform:translate(-50%,-50%) rotate(34deg); box-shadow:0 0 7px rgba(255,32,67,.8) }
      .launch-drone-flight::after { transform:translate(-50%,-50%) rotate(-34deg) }
      .launch-drone-flight i { position:absolute; left:50%; top:50%; width:9px; height:6px; border-radius:50%; background:#ff3658; transform:translate(-50%,-50%); box-shadow:0 0 6px 2px rgba(255,47,77,.9),0 0 20px 7px rgba(255,25,63,.5) }
      .launch-drone-flight b { position:absolute; left:50%; top:50%; width:3px; height:3px; border-radius:50%; background:#fff2f4; transform:translate(-50%,-50%); box-shadow:-11px -7px 0 rgba(255,70,95,.9),11px 7px 0 rgba(255,70,95,.9),-11px 7px 0 rgba(255,180,190,.85),11px -7px 0 rgba(255,180,190,.85) }
      .launch-drone-a { left:13%; top:42%; --dx:16vw; --dy:-19vh; --delay:0s }
      .launch-drone-b { right:14%; top:38%; --dx:-16vw; --dy:-13vh; --delay:1.2s }
      .launch-drone-c { left:50%; top:68%; --dx:5vw; --dy:-27vh; --delay:2.5s }
      .launch-drone-d { left:75%; top:64%; --dx:-24vw; --dy:-22vh; --delay:3.4s }
      @keyframes esh-stars-drift { to { background-position:230px 190px,-310px 260px,370px -290px,-280px 220px,420px -330px } }
      @keyframes esh-mark-arrive { 0% { opacity:0; transform:translateY(34px) rotateX(42deg) rotateY(-8deg) rotateZ(-2deg) translateZ(-120px) scale(.76); filter:blur(12px) } 65% { opacity:1; filter:blur(0) } 100% { opacity:1; transform:rotateX(15deg) rotateY(-2deg) rotateZ(-.6deg) translateZ(0) scale(1); filter:blur(0) } }
      @keyframes esh-drone-shimmer { 0% { opacity:.94; filter:brightness(1) saturate(1.08) } 100% { opacity:1; filter:brightness(1.1) saturate(1.14) } }
      @keyframes esh-firework { 0%,100% { opacity:0; transform:scale(.45) rotate(0deg) } 12% { opacity:.95 } 58% { opacity:.65; transform:scale(1) rotate(28deg) } 82% { opacity:0; transform:scale(1.16) rotate(44deg) } }
      @keyframes esh-drone-flight { 0%,100% { transform:translate3d(0,0,0) scale(.68) rotateX(8deg); opacity:.28 } 12% { opacity:.95 } 50% { transform:translate3d(var(--dx),var(--dy),75px) scale(1.18) rotateX(-6deg); opacity:1 } 78% { opacity:.75 } }
      @keyframes esh-orbit-a { to { transform:translate(-50%,-50%) rotateX(72deg) rotateZ(352deg) } }
      @keyframes esh-orbit-b { to { transform:translate(-50%,-50%) rotateX(68deg) rotateZ(-348deg) } }
      @keyframes esh-shooting-star { 0%,14% { opacity:0; transform:translate3d(0,0,0) rotate(-30deg) scaleX(.2) } 18% { opacity:1 } 38% { opacity:0; transform:translate3d(48vw,28vh,0) rotate(-30deg) scaleX(1.5) } 100% { opacity:0 } }
      @keyframes esh-haze-breathe { to { opacity:.62; transform:scale(1.05) } }
      @keyframes esh-crest-float { 50% { transform:translateY(-7px); box-shadow:0 0 48px rgba(255,20,54,.34),inset 0 0 22px rgba(255,20,54,.18) } }
      @media (prefers-reduced-motion: reduce) { .launch-confetti { display:none } .launch-slide-in,.launch-countdown-value,.launch-sky-stars,.launch-drone-mark,.launch-firework,.launch-drone-flight,.launch-sky-haze,.launch-crest-wrap,.launch-sky-orbit,.launch-shooting-star { animation:none } }
    `}</style>
  </main>;
}
