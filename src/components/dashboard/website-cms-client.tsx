"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Calendar,
  Trophy,
  MapPin,
  UserCheck,
  Shield,
  Clock,
  Eye,
  Download,
  Megaphone,
  CheckCircle2,
  ExternalLink,
  Save,
  Plus,
  FileText,
  AlertTriangle,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateTimeInput } from "@/components/ui/datetime-input";

interface MatchOption {
  id: string;
  homeTeamName: string;
  awayTeamName: string;
  isHomeFixture: boolean;
  matchDate: string; // ISO string
  stadium: string | null;
  refereeName: string | null;
  status: "SCHEDULED" | "LIVE" | "FINISHED" | "CANCELLED" | "POSTPONED";
  homeScore: number | null;
  awayScore: number | null;
  matchReport: string | null;
  competitionId: string;
  competitionName: string;
  teamId: string | null;
  teamName: string | null;
  opponentLogo?: string | null;
  documents: Array<{
    id: string;
    name: string;
    mimeType: string;
    sizeBytes: number;
  }>;
}

interface SavedOpponent {
  name: string;
  logoUrl: string;
  stadium?: string;
}

interface WebsiteCmsClientProps {
  locale: string;
  matches: MatchOption[];
  competitions: Array<{ id: string; name: string }>;
  teams: Array<{ id: string; name: string; category: string }>;
  savedOpponents?: SavedOpponent[];
  clubName: string;
  saveMatchAction: (formData: FormData) => Promise<{ success: boolean; matchId?: string; error?: string }>;
}

export function WebsiteCmsClient({
  locale,
  matches,
  competitions,
  teams,
  savedOpponents = [],
  clubName,
  saveMatchAction
}: WebsiteCmsClientProps) {
  const isRtl = locale === "ar";
  const [selectedMatchId, setSelectedMatchId] = useState<string>(
    matches[0]?.id || "NEW"
  );

  const selectedMatch = matches.find((m) => m.id === selectedMatchId);

  // Form states
  const [opponent, setOpponent] = useState(
    selectedMatch
      ? selectedMatch.isHomeFixture
        ? selectedMatch.awayTeamName
        : selectedMatch.homeTeamName
      : ""
  );
  const [isHomeFixture, setIsHomeFixture] = useState(selectedMatch ? selectedMatch.isHomeFixture : true);
  const [matchDate, setMatchDate] = useState(
    selectedMatch
      ? new Date(selectedMatch.matchDate).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16)
  );
  const [stadium, setStadium] = useState(selectedMatch?.stadium || (isRtl ? "الملعب البلدي بسيدي حسني" : "Stade Municipal Sidi Hosni"));
  const [refereeName, setRefereeName] = useState(selectedMatch?.refereeName || "");
  const [status, setStatus] = useState<string>(selectedMatch?.status || "SCHEDULED");
  const [homeScore, setHomeScore] = useState<string>(selectedMatch?.homeScore?.toString() || "");
  const [awayScore, setAwayScore] = useState<string>(selectedMatch?.awayScore?.toString() || "");
  const [competitionId, setCompetitionId] = useState(selectedMatch?.competitionId || competitions[0]?.id || "");
  const [teamId, setTeamId] = useState(selectedMatch?.teamId || teams[0]?.id || "");
  const [matchReport, setMatchReport] = useState(selectedMatch?.matchReport || "");

  // Opponent Logo State
  const [selectedOpponentLogoUrl, setSelectedOpponentLogoUrl] = useState<string | null>(
    selectedMatch?.opponentLogo || null
  );
  const [previewLogo, setPreviewLogo] = useState<string | null>(
    selectedMatch?.opponentLogo || null
  );
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // Save state and form feedback
  const [isSaving, startSaving] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Preview Modal State
  const [previewDoc, setPreviewDoc] = useState<{ title: string; url: string } | null>(null);

  const handleOpponentChange = (value: string) => {
    setOpponent(value);
    const matched = savedOpponents.find(
      (o) => o.name.trim().toLowerCase() === value.trim().toLowerCase()
    );
    if (matched) {
      setSelectedOpponentLogoUrl(matched.logoUrl);
      setPreviewLogo(matched.logoUrl);
      if (matched.stadium && !isHomeFixture) {
        setStadium(matched.stadium);
      }
    }
  };

  const handleSelectMatch = (id: string) => {
    setSelectedMatchId(id);
    setFeedback(null);
    setLogoFile(null);
    if (id === "NEW") {
      setOpponent("");
      setIsHomeFixture(true);
      setMatchDate(new Date().toISOString().slice(0, 16));
      setStadium(isRtl ? "الملعب البلدي بسيدي حسني" : "Stade Municipal Sidi Hosni");
      setRefereeName("");
      setStatus("SCHEDULED");
      setHomeScore("");
      setAwayScore("");
      setCompetitionId(competitions[0]?.id || "");
      setTeamId(teams[0]?.id || "");
      setMatchReport("");
      setSelectedOpponentLogoUrl(null);
      setPreviewLogo(null);
    } else {
      const match = matches.find((m) => m.id === id);
      if (match) {
        const opp = match.isHomeFixture ? match.awayTeamName : match.homeTeamName;
        setOpponent(opp);
        setIsHomeFixture(match.isHomeFixture);
        setMatchDate(new Date(match.matchDate).toISOString().slice(0, 16));
        setStadium(match.stadium || "");
        setRefereeName(match.refereeName || "");
        setStatus(match.status);
        setHomeScore(match.homeScore !== null ? match.homeScore.toString() : "");
        setAwayScore(match.awayScore !== null ? match.awayScore.toString() : "");
        setCompetitionId(match.competitionId);
        setTeamId(match.teamId || teams[0]?.id || "");
        setMatchReport(match.matchReport || "");
        setSelectedOpponentLogoUrl(match.opponentLogo || null);
        setPreviewLogo(match.opponentLogo || null);
      }
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const formData = new FormData();
    if (selectedMatchId !== "NEW") {
      formData.set("id", selectedMatchId);
    }
    formData.set("opponent", opponent);
    formData.set("isHomeFixture", isHomeFixture ? "true" : "false");
    formData.set("matchDate", new Date(matchDate).toISOString());
    formData.set("stadium", stadium);
    formData.set("refereeName", refereeName);
    formData.set("status", status);
    formData.set("competitionId", competitionId);
    formData.set("teamId", teamId);
    if (logoFile) {
      formData.set("opponentLogoFile", logoFile);
    } else if (selectedOpponentLogoUrl) {
      formData.set("opponentLogoUrl", selectedOpponentLogoUrl);
    }
    if (homeScore !== "") formData.set("homeScore", homeScore);
    if (awayScore !== "") formData.set("awayScore", awayScore);
    if (matchReport) formData.set("matchReport", matchReport);

    startSaving(async () => {
      try {
        const res = await saveMatchAction(formData);
        if (res.success) {
          setFeedback({
            type: "success",
            message: isRtl ? "تم حفظ وتحديث بيانات المباراة بنجاح، وظهورها في واجهة الموقع العام" : "Match enregistré avec succès sur le site public."
          });
          if (res.matchId && selectedMatchId === "NEW") {
            setSelectedMatchId(res.matchId);
          }
        } else {
          setFeedback({ type: "error", message: res.error || (isRtl ? "حدث خطأ أثناء الحفظ" : "Erreur de sauvegarde") });
        }
      } catch (err: any) {
        setFeedback({ type: "error", message: err.message || (isRtl ? "فشل حفظ المباراة" : "Échec d'enregistrement") });
      }
    });
  };

  // Find linked match documents
  const matchSheetDoc = selectedMatch?.documents.find(
    (d) => d.name.includes("ورقة المباراة") || d.name.toLowerCase().includes("sheet") || d.name.toLowerCase().includes("feuille")
  );
  const refereeReportDoc = selectedMatch?.documents.find(
    (d) => d.name.includes("تقرير الحكم") || d.name.toLowerCase().includes("rapport") || d.name.toLowerCase().includes("arbitre")
  );

  return (
    <div className="space-y-6">
      {/* 1. Official Branded Header Banner */}
      <div
        className="relative overflow-hidden rounded-2xl border border-border/80 bg-cover bg-center p-6 sm:p-8 text-white shadow-lg"
        style={{ backgroundImage: "url('/branding/esh-header-crest.png')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/75 to-black/45 pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/15 px-3 py-0.5 text-xs font-bold text-red-400 mb-2">
              <Megaphone className="h-3.5 w-3.5" />
              <span>{isRtl ? "مركز إدارة محتوى الموقع العام والمباريات" : "CMS Site Officiel & Gestion des Matchs"}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {isRtl ? "إدارة مباراة اليوم والمحتوى الإعلامي" : "Gestion du Prochain Match & Médias"}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-zinc-300 max-w-xl">
              {isRtl
                ? "إدارة تفاصيل المباريات والمحتوى الإعلامي؛ تُرفع وثائق المباراة يدوياً حتى يتوفر مصدر استيراد معتمد."
                : "Gestion des matchs et des médias ; les documents sont téléversés manuellement en attendant une source d'import approuvée."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/${locale}`}
              target="_blank"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/20 transition-all backdrop-blur-xs"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>{isRtl ? "معاينة الموقع العام" : "Voir le site public"}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Feedback Notification */}
      {feedback && (
        <div
          className={`flex items-center gap-3 rounded-xl p-4 text-xs font-bold shadow-xs animate-in fade-in duration-200 ${
            feedback.type === "success"
              ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* 3. Main Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Match Selector & FAF Connect Status (lg:col-span-4) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Match Picker */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <span>{isRtl ? "المباريات المتاحة للإدارة" : "Sélection du Match"}</span>
              </h3>
              <Button
                type="button"
                size="sm"
                variant={selectedMatchId === "NEW" ? "default" : "outline"}
                onClick={() => handleSelectMatch("NEW")}
                className="text-xs font-bold gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{isRtl ? "مباراة جديدة" : "Nouveau"}</span>
              </Button>
            </div>

            <div className="space-y-2 max-h-[380px] overflow-y-auto scrollbar-thin pe-1">
              {matches.map((m) => {
                const isSelected = m.id === selectedMatchId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelectMatch(m.id)}
                    className={`w-full text-start p-3 rounded-xl border transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-xs"
                        : "border-border/70 bg-background/50 hover:bg-muted/60"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                      <span className="font-semibold text-primary">{m.competitionName}</span>
                      <span>
                        {new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(
                          new Date(m.matchDate)
                        )}
                      </span>
                    </div>
                    <div className="text-xs font-extrabold text-foreground truncate">
                      {m.homeTeamName} VS {m.awayTeamName}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                      <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
                        {m.isHomeFixture ? (isRtl ? "مضيف" : "Domicile") : (isRtl ? "ضيف" : "Extérieur")}
                      </span>
                      <span>•</span>
                      <span>{m.stadium || (isRtl ? "الملعب البلدي" : "Stade")}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* FAF Connect availability */}
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 shadow-xs space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black">
                  <Shield className="h-5 w-5" />
                </span>
                <div>
                  <h4 className="text-xs font-extrabold text-foreground uppercase tracking-wider">
                    FAF Connect EMS
                  </h4>
                  <p className="text-[11px] text-muted-foreground">{isRtl ? "حالة التكامل" : "État de l'intégration"}</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                <span>{isRtl ? "استيراد البيانات غير مفعّل" : "Import indisponible"}</span>
              </span>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {isRtl
                ? "بيانات الدخول محفوظة، لكن لا توجد واجهة بيانات موثقة لجلب أوراق المباريات. لن تُعرض سجلات محلية على أنها صادرة من الاتحاد دون التحقق من مصدرها."
                : "Les identifiants sont configurés, mais aucune interface officielle de données n'est disponible. Les documents locaux ne seront pas présentés comme officiels sans provenance vérifiée."}
            </p>

            <Button
              type="button"
              disabled
              className="w-full gap-2 text-xs font-bold"
            >
              <span>
                {isRtl ? "بانتظار واجهة أو تصدير رسمي معتمد" : "En attente d'une interface ou d'un export officiel"}
              </span>
            </Button>

            {/* Synchronized Documents Preview & Download */}
            {(matchSheetDoc || refereeReportDoc) && (
              <div className="pt-3 border-t border-emerald-500/20 space-y-2">
                <div className="text-[11px] font-bold text-foreground">
                  {isRtl ? "وثائق محفوظة للمباراة (المصدر غير متحقق):" : "Documents enregistrés (source non vérifiée) :"}
                </div>

                {matchSheetDoc && (
                  <div className="flex items-center justify-between rounded-lg bg-card border border-border p-2.5 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="truncate font-semibold">{isRtl ? "ورقة المباراة المحفوظة" : "Feuille de match enregistrée"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewDoc({
                            title: isRtl ? "ورقة المباراة المحفوظة (المصدر غير متحقق)" : "Feuille enregistrée (source non vérifiée)",
                            url: `/api/documents/${matchSheetDoc.id}/download?inline=true`
                          })
                        }
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title={isRtl ? "معاينة ورقة المباراة" : "Aperçu"}
                      >
                        <Eye className="h-3.5 w-3.5 text-primary" />
                      </button>
                      <a
                        href={`/api/documents/${matchSheetDoc.id}/download`}
                        download
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title={isRtl ? "تحميل ورقة المباراة" : "Télécharger"}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                )}

                {refereeReportDoc && (
                  <div className="flex items-center justify-between rounded-lg bg-card border border-border p-2.5 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="h-4 w-4 text-red-600 shrink-0" />
                      <span className="truncate font-semibold">{isRtl ? "تقرير الحكم المحفوظ" : "Rapport d'arbitre enregistré"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewDoc({
                            title: isRtl ? "تقرير الحكم المحفوظ (المصدر غير متحقق)" : "Rapport enregistré (source non vérifiée)",
                            url: `/api/documents/${refereeReportDoc.id}/download?inline=true`
                          })
                        }
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title={isRtl ? "معاينة تقرير الحكم" : "Aperçu"}
                      >
                        <Eye className="h-3.5 w-3.5 text-primary" />
                      </button>
                      <a
                        href={`/api/documents/${refereeReportDoc.id}/download`}
                        download
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title={isRtl ? "تحميل تقرير الحكم" : "Télécharger"}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Detailed Match Form (lg:col-span-8) */}
        <div className="lg:col-span-8">
          <form onSubmit={handleSave} className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-border/70 pb-4">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {selectedMatchId === "NEW"
                    ? isRtl ? "إضافة وتحديد مباراة جديدة للموقع" : "Créer un nouveau match"
                    : isRtl ? `تعديل بيانات: ${selectedMatch?.homeTeamName} ضد ${selectedMatch?.awayTeamName}` : "Modifier le match"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isRtl
                    ? "تظهر هذه التفاصيل فوراً في واجهة الموقع العام والعد التنازلي للمباراة القادمة"
                    : "Ces informations sont directement publiées sur la page d'accueil."}
                </p>
              </div>

              <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                {status}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Opponent Team Name & Logo */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {isRtl ? "الفريق الخصم والشعار *" : "Équipe adverse & Logo *"}
                </label>
                <input
                  type="text"
                  required
                  value={opponent}
                  onChange={(e) => handleOpponentChange(e.target.value)}
                  placeholder={isRtl ? "مثال: مديوني وهران / شبيبة تيارت" : "Ex: JS Tiaret"}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />

                {/* Opponent Logo Upload and Preview */}
                <div className="flex items-center gap-3 p-2.5 rounded-xl border border-dashed border-border bg-muted/20">
                  <div className="h-10 w-10 shrink-0 rounded-lg border border-border/80 bg-background flex items-center justify-center overflow-hidden">
                    {previewLogo ? (
                      <img src={previewLogo} alt="Logo" className="h-full w-full object-contain p-1" />
                    ) : (
                      <Shield className="h-5 w-5 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                      <span>{isRtl ? "رفع أو تغيير شعار الخصم" : "Téléverser le logo"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setLogoFile(file);
                            const url = URL.createObjectURL(file);
                            setPreviewLogo(url);
                          }
                        }}
                      />
                    </label>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {isRtl ? "يتم حفظ الشعار تلقائياً لإعادة استخدامه في جميع المباريات" : "Mémorisé automatiquement pour les prochains matchs"}
                    </p>
                  </div>
                </div>

                {/* Quick saved opponent chips */}
                {savedOpponents.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {isRtl ? "أندية محفوظة:" : "Clubs enregistrés:"}
                    </span>
                    {savedOpponents.slice(0, 4).map((item) => (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => {
                          setOpponent(item.name);
                          setSelectedOpponentLogoUrl(item.logoUrl);
                          setPreviewLogo(item.logoUrl);
                          if (item.stadium && !isHomeFixture) {
                            setStadium(item.stadium);
                          }
                        }}
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] border transition-colors ${
                          opponent.trim().toLowerCase() === item.name.toLowerCase()
                            ? "bg-primary text-white border-primary font-bold"
                            : "bg-background border-border text-foreground hover:bg-muted"
                        }`}
                      >
                        <img src={item.logoUrl} alt="" className="h-3.5 w-3.5 object-contain" />
                        <span>{item.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Host vs Guest Toggle */}
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {isRtl ? "هل النادي مضيف أم ضيف؟" : "Lieu (Domicile / Extérieur)"}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsHomeFixture(true)}
                    className={`rounded-xl py-2 text-xs font-bold border transition-colors ${
                      isHomeFixture
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {isRtl ? "مضيف (بملعبنا)" : "Domicile"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsHomeFixture(false)}
                    className={`rounded-xl py-2 text-xs font-bold border transition-colors ${
                      !isHomeFixture
                        ? "border-primary bg-primary text-white"
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
                  label={isRtl ? "تاريخ وتوقيت انطلاق المباراة" : "Date et heure du match"}
                  required
                  value={matchDate}
                  onChange={(_, iso) => setMatchDate(iso || "")}
                  locale={locale}
                />
              </div>

              {/* Stadium Location */}
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {isRtl ? "مكان المباراة والملعب *" : "Stade / Lieu du match *"}
                </label>
                <input
                  type="text"
                  required
                  value={stadium}
                  onChange={(e) => setStadium(e.target.value)}
                  placeholder={isRtl ? "الملعب البلدي بسيدي حسني" : "Stade Municipal Sidi Hosni"}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Referee Name */}
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {isRtl ? "اسم الحكم الرئيسي والطاقم" : "Arbitre officiel"}
                </label>
                <input
                  type="text"
                  value={refereeName}
                  onChange={(e) => setRefereeName(e.target.value)}
                  placeholder={isRtl ? "مثال: عزوز محمد (حكم فيدرالي FAF)" : "Ex: M. Azzouz (Arbitre FAF)"}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Match Status */}
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {isRtl ? "حالة المباراة" : "Statut du match"}
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="SCHEDULED">{isRtl ? "مجدولة" : "Programmée"}</option>
                  <option value="LIVE">{isRtl ? "مباشرة الآن" : "En direct"}</option>
                  <option value="FINISHED">{isRtl ? "منتهية" : "Terminée"}</option>
                  <option value="POSTPONED">{isRtl ? "مؤجلة" : "Reportée"}</option>
                  <option value="CANCELLED">{isRtl ? "ملغاة" : "Annulée"}</option>
                </select>
              </div>

              {/* Competition */}
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {isRtl ? "المسابقة / البطولة *" : "Compétition *"}
                </label>
                <select
                  required
                  value={competitionId}
                  onChange={(e) => setCompetitionId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {competitions.map((comp) => (
                    <option key={comp.id} value={comp.id}>
                      {comp.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Team Category */}
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {isRtl ? "فئة الفريق" : "Catégorie d'équipe"}
                </label>
                <select
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {teams.map((tm) => (
                    <option key={tm.id} value={tm.id}>
                      {tm.name} ({tm.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Scores (if LIVE or FINISHED) */}
              {(status === "LIVE" || status === "FINISHED") && (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {isRtl ? `أهداف ${isHomeFixture ? clubName : opponent}` : "Score Domicile"}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={homeScore}
                      onChange={(e) => setHomeScore(e.target.value)}
                      placeholder="0"
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {isRtl ? `أهداف ${isHomeFixture ? opponent : clubName}` : "Score Visiteur"}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={awayScore}
                      onChange={(e) => setAwayScore(e.target.value)}
                      placeholder="0"
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Match Report & Highlights */}
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isRtl ? "ملخص ومجريات المباراة / تقرير اللقاء" : "Résumé du match / Rapport"}
              </label>
              <textarea
                rows={3}
                value={matchReport}
                onChange={(e) => setMatchReport(e.target.value)}
                placeholder={isRtl ? "اكتب ملخصاً صحفياً أو تقرير اللقاء لينشر في تفاصيل المباراة..." : "Résumé du match..."}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-between pt-4 border-t border-border/70">
              <span className="text-xs text-muted-foreground">
                {isRtl ? "التغييرات تحفظ فورياً وتظهر على الصفحة الرئيسية" : "Mise à jour en temps réel sur la page d'accueil."}
              </span>
              <Button type="submit" disabled={isSaving} className="gap-2 font-bold px-6">
                <Save className="h-4 w-4" />
                <span>{isSaving ? (isRtl ? "جارٍ الحفظ..." : "Enregistrement...") : (isRtl ? "حفظ ونشر التعديلات" : "Enregistrer et publier")}</span>
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* 4. In-Browser Document Preview Modal */}
      {previewDoc && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/80 px-5 py-3.5 bg-muted/30">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">{previewDoc.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-zinc-950/20 min-h-[450px]">
              <iframe
                src={previewDoc.url}
                title={previewDoc.title}
                className="w-full h-[75vh] rounded-lg border border-border bg-white shadow-inner"
              />
            </div>

            <div className="flex items-center justify-between border-t border-border/80 px-5 py-3 bg-card">
              <span className="text-xs text-muted-foreground">{isRtl ? "وثيقة محفوظة محلياً؛ المصدر غير متحقق" : "Document local ; source non vérifiée"}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => setPreviewDoc(null)}>
                {isRtl ? "إغلاق" : "Fermer"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
