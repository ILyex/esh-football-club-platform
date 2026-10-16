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
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { FormSelect } from "@/components/ui/form-select";
import { NewMatchLineup } from "@/components/matches/new-match-lineup";
import { MatchPeriodOptions } from "@/components/matches/match-period-options";
import { RefereeNamesInput } from "@/components/matches/referee-names-input";
import { OpponentCrest } from "@/components/public/opponent-crest";
import { localizedClubName, splitClubNameVariants } from "@/lib/public/locale-text";
import { toast } from "sonner";

interface CompetitionOption {
  id: string;
  name: string;
  teamId: string | null;
}

interface TeamOption {
  id: string;
  name: string;
  category: string;
}

interface MatchPlayerOption {
  id: string;
  firstName: string;
  lastName: string;
  position: string | null;
  status: string;
  teamId: string | null;
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
  players: MatchPlayerOption[];
  savedOpponents: SavedOpponent[];
  defaultTeamId?: string | null;
  clubName: string;
  action: (formData: FormData) => Promise<unknown>;
}

export function MatchFormClient({
  locale,
  competitions,
  teams,
  players,
  savedOpponents,
  defaultTeamId,
  clubName,
  action
}: MatchFormClientProps) {
  const isRtl = locale === "ar";
  const [isPending, startTransition] = useTransition();

  // Form interactive states
  const [teamId, setTeamId] = useState(defaultTeamId || teams[0]?.id || "");
  const [competitionId, setCompetitionId] = useState(() => competitions.find((competition) => !competition.teamId || competition.teamId === (defaultTeamId || teams[0]?.id))?.id || "");
  const availableCompetitions = competitions.filter((competition) => !competition.teamId || competition.teamId === teamId);
  const handleTeamChange = (nextTeamId: string) => {
    setTeamId(nextTeamId);
    const firstMatchingCompetition = competitions.find((competition) => !competition.teamId || competition.teamId === nextTeamId);
    setCompetitionId(firstMatchingCompetition?.id || "");
  };
  const [opponent, setOpponent] = useState("");
  const [opponentNameFr, setOpponentNameFr] = useState("");
  const displayOpponent = localizedClubName(opponent, locale, isRtl ? "الفريق الخصم" : "Nom du club adverse");
  const [isHomeFixture, setIsHomeFixture] = useState(true);
  const [stadium, setStadium] = useState(isRtl ? "الملعب البلدي طاهري حسني – سيدي حسني" : "Stade communal Taheri Hosni – Sidi Hosni");
  const [status, setStatus] = useState("SCHEDULED");
  const [matchDate, setMatchDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(14, 30, 0, 0);
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [matchReport, setMatchReport] = useState("");

  const getLocalDateTimeValue = () => {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  };

  const handleStatusChange = (nextStatus: string) => {
    setStatus(nextStatus);
    if (nextStatus === "LIVE") setMatchDate(getLocalDateTimeValue());
  };

  // Logo state
  const [previewLogo, setPreviewLogo] = useState<string | null>(null);
  const previewObjectUrlRef = useRef<string | null>(null);
  const selectedLogoFileRef = useRef<File | null>(null);
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
    selectedLogoFileRef.current = null;
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
    const names = splitClubNameVariants(item.name);
    setOpponent(names.ar);
    setOpponentNameFr(names.fr);
    setLogoPreview(item.logoUrl || null);
    if (item.stadium && !isHomeFixture) {
      setStadium(item.stadium);
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      selectedLogoFileRef.current = file;
      const objectUrl = URL.createObjectURL(file);
      setLogoPreview(objectUrl);
    }
  };

  // Toggle home/away fixture
  const handleFixtureChange = (home: boolean) => {
    setIsHomeFixture(home);
    if (home) {
      setStadium(isRtl ? "الملعب البلدي طاهري حسني – سيدي حسني" : "Stade communal Taheri Hosni – Sidi Hosni");
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
    if (selectedLogoFileRef.current) {
      formData.set("opponentLogoFile", selectedLogoFileRef.current);
    }
    startTransition(async () => {
      try {
        const result = await action(formData) as { formError?: { field?: string; message: string } } | undefined;
        if (result?.formError) {
          if (result.formError.field) {
            const field = document.querySelector<HTMLElement>(`[name="${CSS.escape(result.formError.field)}"]`);
            field?.focus();
            field?.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          toast.error(result.formError.message);
          return;
        }
        toast.success(isRtl ? "تم حفظ وبرمجة المباراة بنجاح" : "Match programmé avec succès");
      } catch (error) {
        console.error("Match create failed:", error);
        toast.error(isRtl ? "تعذر حفظ المباراة. تحقق من البيانات ثم أعد المحاولة." : "Impossible d’enregistrer le match. Vérifiez les données puis réessayez.");
      }
    });
  };

  return (
    <form action={handleSubmit} className="space-y-6">
      <input type="hidden" name="locale" value={locale} />
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
                <OpponentCrest src={previewLogo} alt={opponent} className="h-full w-full object-contain" iconClassName="h-8 w-8 text-muted-foreground" />
              ) : (
                <Shield className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-0.5 text-start md:text-center">
              <h3 className="text-base font-extrabold text-foreground truncate max-w-[180px]">
                {isHomeFixture ? clubName : displayOpponent}
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
                <OpponentCrest src={previewLogo} alt={opponent} className="h-full w-full object-contain" iconClassName="h-8 w-8 text-muted-foreground" />
              ) : (
                <Shield className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-0.5 text-start md:text-center">
              <h3 className="text-base font-extrabold text-foreground truncate max-w-[180px]">
                {!isHomeFixture ? clubName : displayOpponent}
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
              onValueChange={handleTeamChange}
              options={teams.map((tm) => ({ value: tm.id, label: tm.name }))}
            />
          </div>

          {/* Competition */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {isRtl ? "المسابقة / البطولة *" : "Compétition *"}
            </label>
            <FormSelect
              key={`competition-${teamId}-${competitionId}`}
              name="competitionId"
              required
              defaultValue={competitionId}
              locale={locale}
              ariaLabel={isRtl ? "المسابقة / البطولة" : "Compétition"}
              onValueChange={setCompetitionId}
              options={availableCompetitions.map((c) => ({ value: c.id, label: c.name }))}
            />
            {availableCompetitions.length === 0 && (
              <p className="mt-1.5 text-xs text-destructive">
                {isRtl ? "لا توجد مسابقة مرتبطة بهذه الفئة." : "Aucune compétition liée à cette catégorie."}
              </p>
            )}
          </div>

          {/* Opponent Name */}
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isRtl ? "اسم الفريق الخصم بالعربية *" : "Nom arabe de l’équipe adverse *"}
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
              required
              dir="rtl"
              value={opponent}
              onChange={(e) => handleOpponentChange(e.target.value)}
              placeholder={isRtl ? "اكتب اسم الفريق الخصم (مثال: مديوني وهران، شبيبة تيارت...)" : "Ex: JS Tiaret"}
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <label htmlFor="opponent-name-fr" className="mb-1.5 mt-3 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {isRtl ? "اسم الفريق الخصم بالفرنسية" : "Nom français de l’équipe adverse"}
            </label>
            <input
              id="opponent-name-fr"
              type="text"
              name="opponentNameFr"
              dir="ltr"
              value={opponentNameFr}
              onChange={(event) => setOpponentNameFr(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
              placeholder="OM Mahdia"
              maxLength={120}
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
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
                      <OpponentCrest src={item.logoUrl} className="h-3.5 w-3.5 object-contain" iconClassName="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span>{localizedClubName(item.name, locale, isRtl ? "فريق منافس" : "Nom du club adverse")}</span>
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
                    <OpponentCrest src={previewLogo} className="h-full w-full object-contain p-1.5" iconClassName="h-7 w-7 text-muted-foreground/40" />
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
              onChange={(draft, iso) => {
                if (iso) setMatchDate(iso);
                else if (!draft) setMatchDate("");
              }}
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
              readOnly={isHomeFixture}
              placeholder={isRtl ? "الملعب البلدي طاهري حسني – سيدي حسني" : "Stade communal Taheri Hosni – Sidi Hosni"}
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 read-only:cursor-not-allowed read-only:opacity-70"
            />
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
              onValueChange={handleStatusChange}
              options={[
                { value: "SCHEDULED", label: isRtl ? "مبرمجة" : "Programmée" },
                { value: "LIVE", label: isRtl ? "مباشر" : "En direct" },
                { value: "FINISHED", label: isRtl ? "انتهت" : "Terminée" },
                { value: "POSTPONED", label: isRtl ? "مؤجلة" : "Reportée" }
              ]}
            />
          </div>

          {/* Referee names */}
          <section className="md:col-span-2 rounded-xl border border-border bg-background/40 p-4 sm:p-5">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-foreground">
                {isRtl ? "حكام اللقاء والطاقم" : "Arbitres du match"}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {isRtl ? "أدخل الأسماء بالترتيب: الحكم الرئيسي، حكما التماس، ثم الحكم الاحتياطي." : "Saisissez les noms dans l’ordre : arbitre principal, assistants, puis arbitre remplaçant."}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs font-semibold text-foreground">{isRtl ? "أسماء الحكام بالعربية" : "Noms des arbitres en arabe"}</p>
                <RefereeNamesInput name="refereeNameAr" locale={locale} nameDirection="rtl" showOrderHint={false} />
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold text-foreground">{isRtl ? "أسماء الحكام بالفرنسية" : "Noms des arbitres en français"}</p>
                <RefereeNamesInput name="refereeNameFr" locale={locale} nameDirection="ltr" showOrderHint={false} />
              </div>
            </div>
          </section>

          <MatchPeriodOptions locale={locale} initialExtraTime={false} initialShootout={false} />

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

        <NewMatchLineup locale={locale} teamId={teamId} players={players} />

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
