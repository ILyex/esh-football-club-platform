"use client";

import { useState } from "react";
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
  const teamOptions = [
    { value: "HOME", label: homeTeamName },
    { value: "AWAY", label: awayTeamName }
  ];
  const eventOptions = [
    { value: "GOAL", label: isAr ? "هدف" : "But" },
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

  return <form action={action} onSubmit={(event) => { if (side === clubSide && !selectedPlayerId) event.preventDefault(); }} className="mt-3 grid grid-cols-1 gap-3 rounded-xl border border-border/70 bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-[minmax(150px,1fr)_minmax(150px,1fr)_88px_minmax(180px,1.4fr)_auto] lg:items-end">
    <input type="hidden" name="entityType" value="PLAYER" />
    <label className="block min-w-0 text-[11px] font-semibold text-muted-foreground">
      <span className="mb-1.5 block">{isAr ? "الحدث" : "Événement"}</span>
      <FormSelect locale={locale} name="type" defaultValue="GOAL" options={eventOptions} compact triggerClassName="!h-10 !px-3 !text-sm" />
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
    <button type="submit" className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-club-primary px-4 text-xs font-bold text-white shadow-sm transition hover:bg-club-primary-hover sm:col-span-2 lg:col-span-1 lg:w-auto"><Flag className="h-4 w-4" aria-hidden="true" />{isAr ? "إضافة الحدث" : "Ajouter l’événement"}</button>
  </form>;
}
