"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DateTimeInput } from "@/components/ui/datetime-input";
import {
  Timer,
  Shield,
  Calendar,
  MapPin,
  FileText,
  Activity,
  Zap,
  ArrowUp,
  CheckCircle2,
  Users,
  Info,
  Loader2
} from "lucide-react";
import { createTestSessionAction } from "@/app/[locale]/(dashboard)/dashboard/testing/actions";

interface TeamItem {
  id: string;
  name?: string | null;
  category: string;
  playerCount: number;
}

interface ProtocolItem {
  id: string;
  code: string;
  name: string;
  category: string;
  description?: string | null;
  primaryUnit: string;
  secondaryUnit?: string | null;
}

interface NewSessionFormProps {
  teams: TeamItem[];
  protocols: ProtocolItem[];
  locale: string;
  defaultDate: string;
}

export function NewSessionForm({
  teams,
  protocols,
  locale,
  defaultDate
}: NewSessionFormProps) {
  const router = useRouter();
  const isAr = locale === "ar";

  const [selectedTeamId, setSelectedTeamId] = useState<string>(teams[0]?.id || "");
  const [selectedProtocolId, setSelectedProtocolId] = useState<string>(
    protocols.find((p) => p.code === "YOYO_IR1")?.id || protocols[0]?.id || ""
  );

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) || teams[0];
  const selectedProtocol = protocols.find((p) => p.id === selectedProtocolId) || protocols[0];

  const getCleanProtocolName = (proto?: ProtocolItem) => {
    if (!proto) return isAr ? "اللياقة البدنية" : "Physique";
    if (proto.code.startsWith("YOYO")) return isAr ? "اختبار يويو" : "Test Yo-Yo";
    return proto.name;
  };

  const defaultTitle = isAr
    ? `اختبار ${getCleanProtocolName(selectedProtocol)} — ${selectedTeam?.name || "الفريق"}`
    : `Évaluation ${getCleanProtocolName(selectedProtocol)} — ${selectedTeam?.name || "Équipe"}`;

  const [title, setTitle] = useState(defaultTitle);
  const [location, setLocation] = useState(
    isAr ? "الملعب البلدي - سيدي حسني (العشب الطبيعي)" : "Stade Municipal — Sidi Hosni (Gazon Naturel)"
  );
  const [date, setDate] = useState(defaultDate);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Update title automatically when team or protocol changes if title was default
  const handleProtocolSelect = (proto: ProtocolItem) => {
    setSelectedProtocolId(proto.id);
    const cleanName = getCleanProtocolName(proto);
    const newTitle = isAr
      ? `اختبار ${cleanName} — ${selectedTeam?.name || "الفريق"}`
      : `Évaluation ${cleanName} — ${selectedTeam?.name || "Équipe"}`;
    setTitle(newTitle);
  };

  const handleTeamChange = (teamId: string) => {
    setSelectedTeamId(teamId);
    const team = teams.find((t) => t.id === teamId);
    const cleanName = getCleanProtocolName(selectedProtocol);
    const newTitle = isAr
      ? `اختبار ${cleanName} — ${team?.name || "الفريق"}`
      : `Évaluation ${cleanName} — ${team?.name || "Équipe"}`;
    setTitle(newTitle);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("teamId", selectedTeamId);
    formData.append("testDefinitionId", selectedProtocolId);
    formData.append("title", title);
    formData.append("date", date);
    formData.append("location", location);
    formData.append("notes", notes);

    try {
      const res = await createTestSessionAction(formData);
      if (res.success && res.sessionId) {
        router.push(`/${locale}/dashboard/testing/${res.sessionId}`);
      } else {
        setErrorMessage(res.error || (isAr ? "فشل إنشاء الجلسة، يرجى التحقق من المدخلات." : "Échec de création."));
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setErrorMessage(err.message || (isAr ? "حدث خطأ غير متوقع." : "Erreur imprévue."));
      setIsSubmitting(false);
    }
  };

  const getProtocolIcon = (code: string) => {
    if (code.startsWith("YOYO")) return Activity;
    if (code.includes("SPRINT") || code.includes("RSA")) return Zap;
    if (code.includes("JUMP")) return ArrowUp;
    return Timer;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMessage && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs font-semibold text-destructive">
          {errorMessage}
        </div>
      )}

      {/* Step 1: Target Team Selection */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 font-mono text-xs font-black text-emerald-600">
              1
            </span>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                {isAr ? "الفريق الرياضي المستهدف" : "Équipe Sportive Ciblée"}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {isAr ? "حدد التشكيلة أو الفئة السنية المراد تقييم جاهزيتها البدنية" : "Sélectionnez l'équipe ou la catégorie à évaluer"}
              </p>
            </div>
          </div>
          {selectedTeam && (
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600">
              <Users className="h-3.5 w-3.5" />
              <span>{selectedTeam.playerCount} {isAr ? "لاعب متاح" : "joueurs"}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {teams.map((team) => {
            const isSelected = team.id === selectedTeamId;
            return (
              <button
                key={team.id}
                type="button"
                onClick={() => handleTeamChange(team.id)}
                className={`relative flex items-center justify-between rounded-xl border p-3.5 text-start transition-all ${
                  isSelected
                    ? "border-emerald-600 bg-emerald-500/5 ring-2 ring-emerald-500/20"
                    : "border-border bg-muted/20 hover:border-border hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                      isSelected
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                        : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    <Shield className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">{team.name || team.category}</p>
                    <p className="text-[10px] text-muted-foreground">{team.playerCount} {isAr ? "لاعب مسجل" : "joueurs"}</p>
                  </div>
                </div>

                {isSelected && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: Protocol Selection */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 font-mono text-xs font-black text-emerald-600">
              2
            </span>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                {isAr ? "بروتوكول الاختبار المعتمد علمياً" : "Protocole d'Évaluation Homologué"}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {isAr ? "اختر بروتوكول الاختبار المراد تطبيقه" : "Choisissez le protocole de test à appliquer"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {protocols.map((proto) => {
            const isSelected = proto.id === selectedProtocolId;
            const Icon = getProtocolIcon(proto.code);
            const isFifaStandard = proto.code === "FIFA_RSA";

            return (
              <button
                key={proto.id}
                type="button"
                onClick={() => handleProtocolSelect(proto)}
                className={`relative flex flex-col justify-between rounded-xl border p-4 text-start transition-all ${
                  isSelected
                    ? "border-emerald-600 bg-emerald-500/5 ring-2 ring-emerald-500/20 shadow-xs"
                    : "border-border bg-muted/20 hover:border-border hover:bg-muted/40"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                          isSelected
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                            : "border-border bg-card text-muted-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="font-mono text-xs font-bold text-foreground">{proto.code}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {isFifaStandard && (
                        <span className="rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-bold text-blue-600 border border-blue-500/20">
                          FIFA RSA
                        </span>
                      )}
                      {isSelected && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                    </div>
                  </div>

                  <p className="text-xs font-bold text-foreground">{proto.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                    {proto.description || (isAr ? "بروتوكول لتقييم القدرات الحركية والبدنية للاعبين." : "Protocole d'évaluation athlétique.")}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                  <span>{isAr ? "الوحدة:" : "Unité :"} <bdi dir="ltr">{proto.primaryUnit}</bdi></span>
                  {proto.secondaryUnit && <bdi dir="ltr">+ {proto.secondaryUnit}</bdi>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 3: Logistics & Session Details */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-2.5 border-b border-border/60 pb-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 font-mono text-xs font-black text-emerald-600">
            3
          </span>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {isAr ? "بيانات ومكان الجلسة الميدانية" : "Détails & Logistique de la Session"}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {isAr ? "تحديد موعد الاختبار، الملعب، وملاحظات المشرف الرياضي" : "Date, heure, lieu du terrain et consignes techniques"}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Session Title */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{isAr ? "عنوان الجلسة والمحضر" : "Titre de la Session"}</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Date & Time */}
            <div>
              <DateTimeInput
                label={isAr ? "تاريخ وتوقيت الاختبار" : "Date & Heure"}
                required
                value={date}
                onChange={(_, iso) => setDate(iso || "")}
                locale={locale}
              />
            </div>

            {/* Location */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{isAr ? "مكان الإجراء والملعب" : "Lieu & Terrain"}</span>
              </label>
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-foreground flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{isAr ? "أهداف وملاحظات المعد البدني (اختياري)" : "Objectifs & Notes du Préparateur (Optionnel)"}</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isAr ? "مثال: تقييم الجاهزية قبل انطلاق مرحلة الإياب، اختبار استرجاع هوائي بعد الراحة الصيفية..." : "Ex: Évaluation pré-saisonnière de l'endurance aérobie..."}
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Form Action Controls */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Link href={`/${locale}/dashboard/testing`}>
          <Button type="button" variant="outline" size="sm" className="h-10 px-5 text-xs font-semibold">
            {isAr ? "إلغاء والعودة" : "Annuler"}
          </Button>
        </Link>
        <Button
          type="submit"
          disabled={isSubmitting}
          size="sm"
          className="h-10 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{isAr ? "جاري إنشاء الجلسة..." : "Création en cours..."}</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              <span>{isAr ? "إنشاء الجلسة وبدء الاختبار الميداني ←" : "Créer et Lancer la Session →"}</span>
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
