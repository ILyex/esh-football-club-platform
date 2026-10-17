"use client";

import { useState, type MouseEvent } from "react";
import { Flag } from "lucide-react";
import { FormSelect } from "@/components/ui/form-select";

type ActivePlayer = { id: string; firstName: string; lastName: string; firstNameFr: string | null; lastNameFr: string | null };

const controlClass = "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground outline-none transition focus:border-club-primary focus:ring-2 focus:ring-club-primary/15";

export function MatchEventEntryForm({
  action,
  locale,
  homeTeamName,
  awayTeamName,
  defaultSide,
  clubSide,
  players
}: {
  action: (formData: FormData) => void | Promise<void>;
  locale: string;
  homeTeamName: string;
  awayTeamName: string;
  defaultSide: "HOME" | "AWAY";
  clubSide: "HOME" | "AWAY";
  players: ActivePlayer[];
}) {
  const isAr = locale === "ar";
  const [side, setSide] = useState(defaultSide);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [type, setType] = useState("GOAL");
  const [shotLocation, setShotLocation] = useState<{ x: number; y: number } | null>(null);
  const teamOptions = [
    { value: "HOME", label: homeTeamName },
    { value: "AWAY", label: awayTeamName }
  ];
  const eventOptions = [
    { value: "GOAL", label: isAr ? "هدف" : "But" },
    { value: "SHOT", label: isAr ? "تسديدة بدون هدف" : "Tir sans but" },
    { value: "PENALTY_GOAL", label: isAr ? "هدف من ركلة جزاء" : "But sur penalty" },
    { value: "PENALTY_MISSED", label: isAr ? "ركلة جزاء ضائعة" : "Penalty manqué" },
    { value: "OWN_GOAL", label: isAr ? "هدف عكسي" : "But contre son camp" },
    { value: "YELLOW_CARD", label: isAr ? "بطاقة صفراء" : "Carton jaune" },
    { value: "RED_CARD", label: isAr ? "بطاقة حمراء" : "Carton rouge" },
    { value: "ASSIST", label: isAr ? "تمريرة حاسمة" : "Passe décisive" },
    { value: "SUBSTITUTION_IN", label: isAr ? "دخول لاعب" : "Entrée d’un joueur" },
    { value: "SUBSTITUTION_OUT", label: isAr ? "خروج لاعب" : "Sortie d’un joueur" }
  ];
  const playerOptions = players.map((player) => ({
    id: player.id,
    name: locale === "fr"
      ? [player.firstNameFr || player.firstName, player.lastNameFr || player.lastName].join(" ")
      : `${player.firstName} ${player.lastName}`
  }));
  const isShotEvent = ["GOAL", "SHOT", "PENALTY_GOAL", "PENALTY_MISSED"].includes(type);
  const isGoalEvent = ["GOAL", "PENALTY_GOAL"].includes(type);

  function selectShotLocation(event: MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setShotLocation({
      x: Math.round(Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100))),
      y: Math.round(Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100)))
    });
  }

  return <form action={action} onSubmit={(event) => { if (side === clubSide && !selectedPlayerId) event.preventDefault(); }} className="mt-3 grid grid-cols-1 gap-3 rounded-xl border border-border/70 bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-[minmax(150px,1fr)_minmax(150px,1fr)_88px_minmax(180px,1.4fr)_auto] lg:items-end">
    <input type="hidden" name="entityType" value="PLAYER" />
    <label className="block min-w-0 text-[11px] font-semibold text-muted-foreground">
      <span className="mb-1.5 block">{isAr ? "الحدث" : "Événement"}</span>
      <FormSelect locale={locale} name="type" value={type} onValueChange={(value) => { setType(value); setShotLocation(null); }} options={eventOptions} compact triggerClassName="!h-10 !px-3 !text-sm" />
    </label>
    <label className="block min-w-0 text-[11px] font-semibold text-muted-foreground">
      <span className="mb-1.5 block">{isAr ? "الفريق" : "Équipe"}</span>
      <FormSelect locale={locale} name="side" value={side} onValueChange={(value) => { setSide(value as "HOME" | "AWAY"); setSelectedPlayerId(""); }} options={teamOptions} compact triggerClassName="!h-10 !px-3 !text-sm" />
    </label>
    <label className="block min-w-0 text-[11px] font-semibold text-muted-foreground">
      <span className="mb-1.5 block">{isAr ? "الدقيقة" : "Minute"}</span>
      <input name="minute" type="number" min="0" max="130" defaultValue="1" required className={`${controlClass} px-2 text-center tabular-nums`} />
    </label>
    {side === clubSide ? <label className="block min-w-0 text-[11px] font-semibold text-muted-foreground">
      <span className="mb-1.5 block">{isAr ? "لاعب النادي" : "Joueur du club"}</span>
      <FormSelect locale={locale} name="playerId" value={selectedPlayerId} onValueChange={setSelectedPlayerId} required disabled={playerOptions.length === 0} options={playerOptions.map((player) => ({ value: player.id, label: player.name }))} placeholder={playerOptions.length ? (isAr ? "اختر اللاعب" : "Choisir le joueur") : (isAr ? "لا يوجد لاعبون نشطون في فئة المباراة" : "Aucun joueur actif dans cette catégorie")} compact triggerClassName="!h-10 !px-3 !text-sm" ariaLabel={isAr ? "اختيار لاعب فئة المباراة" : "Choisir un joueur de la catégorie du match"} />
      {playerOptions.length === 0 && <span className="mt-1 block text-[10px] font-normal text-amber-600 dark:text-amber-400">{isAr ? "اربط لاعبي هذه الفئة بالفريق المحدد للمباراة أولًا." : "Associez d’abord les joueurs à l’équipe sélectionnée pour ce match."}</span>}
    </label> : <label className="block min-w-0 text-[11px] font-semibold text-muted-foreground">
      <span className="mb-1.5 block">{isAr ? "اسم لاعب الخصم" : "Joueur adverse"}</span>
      <input name="playerName" required maxLength={120} placeholder={isAr ? "اكتب اسم اللاعب" : "Saisir le nom du joueur"} className={controlClass} />
    </label>}
    {isShotEvent && <div className="grid gap-3 rounded-lg border border-border/70 bg-background/70 p-3 sm:col-span-2 lg:col-span-5 lg:grid-cols-[minmax(130px,0.7fr)_minmax(220px,1.2fr)_minmax(145px,0.8fr)_minmax(150px,0.8fr)] lg:items-center">
      <label className="block min-w-0 text-[11px] font-semibold text-muted-foreground">
        <span className="mb-1.5 block">{isAr ? "طريقة التسديد" : "Partie du corps"}</span>
        <FormSelect locale={locale} name="bodyPart" defaultValue="" options={[
          { value: "", label: isAr ? "اختر طريقة التسديد" : "Choisir" },
          { value: "UNKNOWN", label: isAr ? "غير محدد" : "Non précisé" },
          { value: "RIGHT_FOOT", label: isAr ? "القدم اليمنى" : "Pied droit" },
          { value: "LEFT_FOOT", label: isAr ? "القدم اليسرى" : "Pied gauche" },
          { value: "HEAD", label: isAr ? "الرأس" : "Tête" },
          { value: "OTHER", label: isAr ? "أخرى" : "Autre" }
        ]} compact triggerClassName="!h-10 !px-3 !text-sm" />
      </label>
      <div className="min-w-0">
        <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">{isAr ? "مكان التسديدة (اضغط على الملعب)" : "Lieu du tir (cliquez sur le terrain)"}</span>
        <svg viewBox="0 0 100 64" preserveAspectRatio="none" role="button" tabIndex={0} aria-label={isAr ? "اختر مكان التسديدة على الملعب" : "Choisir le lieu du tir"} onClick={selectShotLocation} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setShotLocation({ x: 84, y: 50 }); } }} className="h-28 w-full cursor-crosshair rounded-md border border-emerald-300/30 bg-emerald-950/80 text-white focus:outline-none focus:ring-2 focus:ring-club-primary">
          <rect x="2" y="2" width="96" height="60" fill="none" stroke="currentColor" strokeOpacity=".55" />
          <line x1="50" y1="2" x2="50" y2="62" stroke="currentColor" strokeOpacity=".4" />
          <circle cx="50" cy="32" r="8" fill="none" stroke="currentColor" strokeOpacity=".4" />
          <rect x="78" y="18" width="20" height="28" fill="none" stroke="currentColor" strokeOpacity=".5" />
          <rect x="90" y="25" width="8" height="14" fill="none" stroke="currentColor" strokeOpacity=".5" />
          <circle cx="94" cy="32" r="1" fill="currentColor" fillOpacity=".6" />
          {shotLocation && <circle cx={shotLocation.x} cy={shotLocation.y * 0.64} r="2.7" fill="#e11d48" stroke="white" strokeWidth="1" />}
        </svg>
        <input type="hidden" name="shotX" value={shotLocation?.x ?? ""} />
        <input type="hidden" name="shotY" value={shotLocation?.y ?? ""} />
        <p className="mt-1 text-[10px] text-muted-foreground">{shotLocation ? (isAr ? `الموقع التقريبي: ${shotLocation.x}% من طول الملعب` : `Position approximative : ${shotLocation.x}% du terrain`) : type === "GOAL" || type === "SHOT" ? (isAr ? "اختر الموقع لحفظ التسديدة وحساب xG" : "Requis pour enregistrer le tir et calculer le xG") : (isAr ? "اختياري، ويحتسب xG للجزاء تلقائيًا" : "Facultatif ; le xG du penalty est calculé automatiquement")}</p>
      </div>
      {type === "PENALTY_GOAL" || type === "PENALTY_MISSED" ? <input type="hidden" name="shotSituation" value="PENALTY" /> : <label className="block min-w-0 text-[11px] font-semibold text-muted-foreground">
        <span className="mb-1.5 block">{isAr ? "نوع الهجمة" : "Phase de jeu"}</span>
        <FormSelect locale={locale} name="shotSituation" defaultValue="OPEN_PLAY" options={[
          { value: "OPEN_PLAY", label: isAr ? "لعب مفتوح" : "Jeu ouvert" },
          { value: "FREE_KICK", label: isAr ? "ركلة حرة" : "Coup franc" },
          { value: "CORNER", label: isAr ? "ركنية" : "Corner" },
          { value: "OTHER", label: isAr ? "أخرى" : "Autre" }
        ]} compact triggerClassName="!h-10 !px-3 !text-sm" />
      </label>}
      {type === "SHOT" ? <label className="block min-w-0 text-[11px] font-semibold text-muted-foreground">
        <span className="mb-1.5 block">{isAr ? "نتيجة التسديدة" : "Résultat du tir"}</span>
        <FormSelect locale={locale} name="shotOutcome" defaultValue="SAVED" options={[
          { value: "SAVED", label: isAr ? "تصدى لها الحارس" : "Arrêtée" },
          { value: "OFF_TARGET", label: isAr ? "خارج المرمى" : "Hors cadre" },
          { value: "BLOCKED", label: isAr ? "مصدودة" : "Contrée" },
          { value: "WOODWORK", label: isAr ? "القائم أو العارضة" : "Poteau ou barre" }
        ]} compact triggerClassName="!h-10 !px-3 !text-sm" />
      </label> : isGoalEvent && side === clubSide ? <label className="block min-w-0 text-[11px] font-semibold text-muted-foreground">
          <span className="mb-1.5 block">{isAr ? "صاحب التمريرة الحاسمة" : "Passeur décisif"}</span>
          <FormSelect locale={locale} name="assistPlayerId" defaultValue="" options={[{ value: "", label: isAr ? "بدون تمريرة حاسمة" : "Sans passe décisive" }, ...playerOptions.filter((player) => player.id !== selectedPlayerId).map((player) => ({ value: player.id, label: player.name }))]} compact triggerClassName="!h-10 !px-3 !text-sm" />
        </label> : null}
    </div>}
    <button type="submit" className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-club-primary px-4 text-xs font-bold text-white shadow-sm transition hover:bg-club-primary-hover sm:col-span-2 lg:col-span-1 lg:w-auto"><Flag className="h-4 w-4" aria-hidden="true" />{isAr ? "إضافة الحدث" : "Ajouter l’événement"}</button>
  </form>;
}
