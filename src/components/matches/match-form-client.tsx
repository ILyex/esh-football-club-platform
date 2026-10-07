"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  Shield,
  Trophy,
  Calendar,
  MapPin,
  UserCheck,
  Upload,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Info,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { FormSelect } from "@/components/ui/form-select";

interface CompetitionOption {
  id: string;
  name: string;
}

interface TeamOption {
  id: string;
  name: string;
  category: string;
}

interface SavedOpponent {
  name: string;
  logoUrl: string;
  stadium?: string;
}

interface MatchFormClientProps {
  locale: string;
  competitions: CompetitionOption[];
  teams: TeamOption[];
  savedOpponents: SavedOpponent[];
  defaultTeamId?: string | null;
  clubName: string;
  action: (formData: FormData) => Promise<void>;
}

const MATCH_STATUS_PRESENTATION: Record<string, { ar: string; fr: string; className: string }> = {
  SCHEDULED: {
    ar: "مبرمجة",
    fr: "Programmée",
    className: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300"
  },
  LIVE: {
    ar: "مباشرة الآن",
    fr: "En direct",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
  },
  FINISHED: {
    ar: "منتهية",
    fr: "Terminée",
    className: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300"
  },
  POSTPONED: {
    ar: "مؤجلة",
    fr: "Reportée",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
  },
  CANCELLED: {
    ar: "ملغاة",
    fr: "Annulée",
    className: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
  }
};

export function MatchFormClient({
  locale,
  competitions,
  teams,
  savedOpponents,
  defaultTeamId,
  clubName,
  action
}: MatchFormClientProps) {
  const isRtl = locale === "ar";
  const [isPending, startTransition] = useTransition();

  // Form interactive states
  const [teamId, setTeamId] = useState(defaultTeamId || teams[0]?.id || "");
  const [competitionId, setCompetitionId] = useState(competitions[0]?.id || "");
  const [opponent, setOpponent] = useState("");
  const [isHomeFixture, setIsHomeFixture] = useState(true);
  const [stadium, setStadium] = useState(isRtl ? "الملعب البلدي بسيدي حسني" : "Stade Municipal Sidi Hosni");
  const [refereeNames, setRefereeNames] = useState<string[]>([]);
  const [refereeDraft, setRefereeDraft] = useState("");
  const [status, setStatus] = useState("SCHEDULED");
  const [matchDate, setMatchDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(14, 30, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [matchReport, setMatchReport] = useState("");

  const addRefereeNames = () => {
    const names = refereeDraft.split(/[,،]/).map((name) => name.trim()).filter(Boolean);
    if (!names.length) return;
    setRefereeNames((current) => {
      const known = new Set(current.map((name) => name.toLocaleLowerCase()));
      const next = [...current];
      for (const name of names) {
        const key = name.toLocaleLowerCase();
        if (known.has(key)) continue;
        const candidate = [...next, name].join(", ");
        if (candidate.length > 120) break;
        known.add(key);
        next.push(name);
      }
      return next;
    });
    setRefereeDraft("");
  };

  // Logo state
  const [previewLogo, setPreviewLogo] = useState<string | null>(null);
  const previewObjectUrlRef = useRef<string | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (previewObjectUrlRef.current) URL.revokeObjectURL(previewObjectUrlRef.current);
  }, []);

  const setLogoPreview = (url: string | null) => {
    if (previewObjectUrlRef.current && previewObjectUrlRef.current !== url) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
    if (url?.startsWith("blob:")) previewObjectUrlRef.current = url;
    setPreviewLogo(url);
  };

  const clearLogoFile = () => {
    if (logoFileInputRef.current) logoFileInputRef.current.value = "";
  };

  // When opponent name is typed or chosen, auto-fill existing logo & stadium if saved
  const handleOpponentChange = (value: string) => {
    setOpponent(value);
    const matched = savedOpponents.find(
      (o) => o.name.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase() ===
        value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase()
    );
    if (matched?.logoUrl) {
      clearLogoFile();
      setLogoPreview(matched.logoUrl);
      if (matched.stadium && !isHomeFixture) {
        setStadium(matched.stadium);
      }
    } else {
      // Keep a newly selected file attached while the user finishes typing;
      // only discard a stale logo loaded from a different saved club.
      if (!previewObjectUrlRef.current) setLogoPreview(null);
    }
  };

  const handleSelectSavedOpponent = (item: SavedOpponent) => {
    clearLogoFile();
    setOpponent(item.name);
    setLogoPreview(item.logoUrl || null);
    if (item.stadium && !isHomeFixture) {
      setStadium(item.stadium);
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setLogoPreview(objectUrl);
    }
  };

  // Toggle home/away fixture
  const handleFixtureChange = (home: boolean) => {
    setIsHomeFixture(home);
    if (home) {
      setStadium(isRtl ? "الملعب البلدي بسيدي حسني" : "Stade Municipal Sidi Hosni");
    } else {
      const matched = savedOpponents.find(
        (o) => o.name.trim().toLowerCase() === opponent.trim().toLowerCase()
      );
      if (matched?.stadium) {
        setStadium(matched.stadium);
      } else {
        setStadium(isRtl ? `ملعب ${opponent || "الخصم"}` : `Stade de ${opponent || "l'adversaire"}`);
      }
    }
  };

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      await action(formData);
    });
  };

  return (
    <form action={handleSubmit} className="space-y-6">
      {/* 1. Header Card with Live Duel Preview */}
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card/90 to-background p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div>
            <h2 className="text-xl font-black tracking-tight text-foreground">
              {isRtl ? "معاينة مواجهة المباراة" : "Aperçu de l'affiche du match"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isRtl
                ? "أي مباراة تضيفها هنا تظهر فوراً في واجهة الموقع، الرزنامة، والعد التنازلي دون تكرار"
                : "Toute programmation est instantanément synchronisée sur le portail public."}
            </p>
          </div>

          <span
            dir={isRtl ? "rtl" : "ltr"}
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${MATCH_STATUS_PRESENTATION[status]?.className ?? "border-border bg-muted text-muted-foreground"}`}
          >
            {MATCH_STATUS_PRESENTATION[status]
              ? (isRtl ? MATCH_STATUS_PRESENTATION[status].ar : MATCH_STATUS_PRESENTATION[status].fr)
              : status}
          </span>
        </div>

        {/* Visual Match Duel Card */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-12 items-center gap-4 rounded-xl bg-muted/30 border border-border/60 p-4 sm:p-6 text-center">
          {/* Home Team */}
          <div className="md:col-span-4 flex items-center md:flex-col gap-3 justify-center">
            <div className="relative flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-2xl border-2 border-border bg-card p-2 shadow-2xs">
              {isHomeFixture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/branding/esh-logo-128.png" alt={clubName} className="h-full w-full object-contain" />
              ) : previewLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewLogo} alt={opponent} className="h-full w-full object-contain" />
              ) : (
                <Shield className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-0.5 text-start md:text-center">
              <h3 className="text-base font-extrabold text-foreground truncate max-w-[180px]">
                {isHomeFixture ? clubName : opponent || (isRtl ? "الفريق الخصم" : "Adversaire")}
              </h3>
              <span className="inline-block rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold">
                {isRtl ? "المضيف (داخل الديار)" : "Domicile"}
              </span>
            </div>
          </div>

          {/* Versus Center */}
          <div className="md:col-span-4 flex flex-col items-center justify-center py-2 space-y-2">
            <span className="rounded-full bg-club-primary text-white text-xs font-black px-3 py-1 shadow-xs tracking-wider">
              VS
            </span>
            <div className="text-xs font-bold text-muted-foreground">
              {stadium}
            </div>
          </div>

          {/* Away Team */}
          <div className="md:col-span-4 flex items-center md:flex-col gap-3 justify-center">
            <div className="relative flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-2xl border-2 border-border bg-card p-2 shadow-2xs">
              {!isHomeFixture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/branding/esh-logo-128.png" alt={clubName} className="h-full w-full object-contain" />
              ) : previewLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewLogo} alt={opponent} className="h-full w-full object-contain" />
              ) : (
                <Shield className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-0.5 text-start md:text-center">
              <h3 className="text-base font-extrabold text-foreground truncate max-w-[180px]">
                {!isHomeFixture ? clubName : opponent || (isRtl ? "الفريق الخصم" : "Adversaire")}
              </h3>
              <span className="inline-block rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 text-[10px] font-bold">
                {isRtl ? "الضيف (خارج الديار)" : "Extérieur"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Form Inputs Grid */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Team Category */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {isRtl ? "فئة الفريق *" : "Catégorie de l'équipe *"}
            </label>
            <FormSelect
              name="teamId"
              required
              defaultValue={teamId}
              locale={locale}
              ariaLabel={isRtl ? "فئة الفريق" : "Catégorie de l'équipe"}
              onValueChange={setTeamId}
              options={teams.map((tm) => ({ value: tm.id, label: `${tm.name} (${tm.category})` }))}
            />
          </div>

          {/* Competition */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {isRtl ? "المسابقة / البطولة *" : "Compétition *"}
            </label>
            <FormSelect
              name="competitionId"
              required
              defaultValue={competitionId}
              locale={locale}
              ariaLabel={isRtl ? "المسابقة / البطولة" : "Compétition"}
              onValueChange={setCompetitionId}
              options={competitions.map((c) => ({ value: c.id, label: c.name }))}
            />
          </div>

          {/* Opponent Name */}
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isRtl ? "الفريق الخصم *" : "Équipe adverse *"}
              </label>
              {savedOpponents.length > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  {isRtl ? "أو اختر من أندية سابقة:" : "Clubs enregistrés:"}
                </span>
              )}
            </div>
            <input
              type="text"
              name="opponent"
              list="saved-opponent-clubs"
              required
              value={opponent}
              onChange={(e) => handleOpponentChange(e.target.value)}
              placeholder={isRtl ? "اكتب اسم الفريق الخصم (مثال: مديوني وهران، شبيبة تيارت...)" : "Ex: JS Tiaret"}
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <datalist id="saved-opponent-clubs">
              {savedOpponents.map((item) => <option key={item.name} value={item.name} />)}
            </datalist>

            {/* Quick chips of saved opponents */}
            {savedOpponents.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {savedOpponents.slice(0, 6).map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => handleSelectSavedOpponent(item)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted px-2.5 py-1 text-xs font-medium text-foreground transition-all"
                  >
                    {item.logoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.logoUrl} alt="" className="h-3.5 w-3.5 object-contain" />
                    )}
                    <span>{item.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Opponent Logo Upload & Auto-save (Redesigned) */}
          <div className="md:col-span-2 rounded-2xl border-2 border-dashed border-border/80 bg-muted/20 p-5 transition-all hover:border-primary/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-border bg-card shadow-xs overflow-hidden">
                  {previewLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewLogo} alt="" className="h-full w-full object-contain p-1.5" />
                  ) : (
                    <Shield className="h-7 w-7 text-muted-foreground/40" />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-bold text-foreground">
                    {isRtl ? "شعار الفريق الخصم" : "Logo de l'équipe adverse"}
                  </label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {previewLogo && !previewObjectUrlRef.current
                      ? (isRtl ? "استخدمنا شعار هذا المنافس المحفوظ تلقائيًا؛ لا حاجة لرفعه مرة أخرى" : "Logo enregistré réutilisé automatiquement.")
                      : isRtl
                      ? "يتم حفظ الشعار تلقائياً في مكتبة النادي ويظهر مباشرة في البوستر والموقع العام"
                      : "Sauvegardé automatiquement pour les prochaines confrontations"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-primary/90 transition-all">
                  <Upload className="h-4 w-4" />
                  <span>{previewLogo ? (isRtl ? "تغيير الشعار" : "Changer le logo") : (isRtl ? "رفع الشعار (PNG/JPG)" : "Téléverser le logo")}</span>
                  <input
                    ref={logoFileInputRef}
                    type="file"
                    name="opponentLogoFile"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleLogoFileChange}
                    className="hidden"
                  />
                </label>
                {previewLogo && (
                  <button
                    type="button"
                    onClick={() => {
                      clearLogoFile();
                      setLogoPreview(null);
                    }}
                    className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    {isRtl ? "إزالة" : "Retirer"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Host vs Guest (مضيف / ضيف) */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {isRtl ? "موقع اللقاء: مضيف أم ضيف؟ *" : "Lieu: Domicile ou Extérieur *"}
            </label>
            <input type="hidden" name="isHomeFixture" value={isHomeFixture ? "true" : "false"} />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleFixtureChange(true)}
                className={`rounded-xl py-2.5 text-xs font-bold border transition-all ${
                  isHomeFixture
                    ? "border-primary bg-primary text-white shadow-xs"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {isRtl ? "مضيف (بملعبنا)" : "Domicile"}
              </button>
              <button
                type="button"
                onClick={() => handleFixtureChange(false)}
                className={`rounded-xl py-2.5 text-xs font-bold border transition-all ${
                  !isHomeFixture
                    ? "border-primary bg-primary text-white shadow-xs"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {isRtl ? "ضيف (خارج الديار)" : "Extérieur"}
              </button>
            </div>
          </div>

          {/* Match Date and Time */}
          <div>
            <DateTimeInput
              label={isRtl ? "تاريخ وتوقيت انطلاق المباراة" : "Date et heure du coup d'envoi"}
              name="matchDate"
              required
              value={matchDate}
              onChange={(_, iso) => setMatchDate(iso || "")}
              locale={locale}
            />
          </div>

          {/* Stadium */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {isRtl ? "الملعب ومكان إجراء اللقاء *" : "Stade / Lieu *"}
            </label>
            <input
              type="text"
              name="stadium"
              required
              value={stadium}
              onChange={(e) => setStadium(e.target.value)}
              placeholder={isRtl ? "الملعب البلدي بسيدي حسني" : "Stade Municipal Sidi Hosni"}
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Referee */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {isRtl ? "حكم اللقاء الرئيسي والطاقم" : "Arbitre officiel"}
            </label>
            <div dir={isRtl ? "rtl" : "ltr"} className="flex min-h-11 w-full flex-wrap items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 transition-colors focus-within:border-club-primary focus-within:ring-2 focus-within:ring-club-primary/15">
              <input type="hidden" name="refereeName" value={refereeNames.join(", ")} />
              {refereeNames.map((name, index) => (
                <span key={`${name}-${index}`} className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-club-primary/25 bg-club-primary/10 px-2.5 py-1 text-xs font-semibold text-club-primary">
                  <span className="max-w-56 truncate">{name}</span>
                  <button
                    type="button"
                    onClick={() => setRefereeNames((current) => current.filter((_, nameIndex) => nameIndex !== index))}
                    aria-label={isRtl ? `حذف الحكم ${name}` : `Retirer l’arbitre ${name}`}
                    title={isRtl ? "حذف الاسم" : "Supprimer le nom"}
                    className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-club-primary/75 transition-colors hover:bg-club-primary/15 hover:text-club-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-primary/40"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={refereeDraft}
                onChange={(event) => setRefereeDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addRefereeNames();
                  } else if (event.key === "Backspace" && !refereeDraft && refereeNames.length > 0) {
                    setRefereeNames((current) => current.slice(0, -1));
                  }
                }}
                placeholder={isRtl ? "اكتب اسم الحكم واضغط Enter" : "Saisissez un nom puis appuyez sur Entrée"}
                autoComplete="off"
                className="min-w-40 flex-1 border-0 bg-transparent px-1 py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-0"
              />
            </div>
          </div>

          {/* Match Status */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {isRtl ? "حالة المباراة *" : "Statut du match *"}
            </label>
            <FormSelect
              name="status"
              defaultValue={status}
              locale={locale}
              required
              ariaLabel={isRtl ? "حالة المباراة" : "Statut du match"}
              onValueChange={setStatus}
              options={[
                { value: "SCHEDULED", label: isRtl ? "مبرمجة" : "Programmée" },
                { value: "LIVE", label: isRtl ? "مباشرة الآن" : "En direct" },
                { value: "FINISHED", label: isRtl ? "منتهية" : "Terminée" },
                { value: "POSTPONED", label: isRtl ? "مؤجلة" : "Reportée" },
                { value: "CANCELLED", label: isRtl ? "ملغاة" : "Annulée" }
              ]}
            />
          </div>

          {/* Scores (if LIVE or FINISHED) */}
          {(status === "LIVE" || status === "FINISHED") ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {isRtl ? "أهداف المضيف" : "Score Domicile"}
                </label>
                <input
                  type="number"
                  name="homeScore"
                  min="0"
                  value={homeScore}
                  onChange={(e) => setHomeScore(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {isRtl ? "أهداف الضيف" : "Score Extérieur"}
                </label>
                <input
                  type="number"
                  name="awayScore"
                  min="0"
                  value={awayScore}
                  onChange={(e) => setAwayScore(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center text-xs text-muted-foreground bg-muted/20 rounded-xl p-3 border border-border">
              <Info className="h-4 w-4 me-2 text-primary shrink-0" />
              <span>
                {isRtl
                  ? "النتيجة تفتح تلقائياً عند تغيير حالة المباراة إلى مباشرة أو منتهية"
                  : "Le score s'active lorsque le match est en direct ou terminé."}
              </span>
            </div>
          )}
        </div>

        {/* Match Report Summary */}
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {isRtl ? "تقرير وملاحظات المباراة (تقرير فني / صحفي)" : "Rapport et observations du match"}
          </label>
          <textarea
            name="matchReport"
            rows={3}
            value={matchReport}
            onChange={(e) => setMatchReport(e.target.value)}
            placeholder={isRtl ? "اكتب تفاصيل أو ملاحظات عن المباراة..." : "Observations sur la rencontre..."}
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-5 border-t border-border/80">
          <Link href={`/${locale}/dashboard/matches`}>
            <Button type="button" variant="outline" size="sm">
              {isRtl ? "إلغاء والعودة" : "Annuler"}
            </Button>
          </Link>
          <Button type="submit" disabled={isPending} className="gap-2 font-bold px-6 shadow-xs">
            <CheckCircle2 className="h-4 w-4" />
            <span>{isPending ? (isRtl ? "جارٍ الحفظ والنشر..." : "Enregistrement...") : (isRtl ? "حفظ وبرمجة المباراة فورياً" : "Programmer le match")}</span>
          </Button>
        </div>
      </div>
    </form>
  );
}
