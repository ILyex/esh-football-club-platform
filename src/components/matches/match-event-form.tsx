"use client";

import { useState } from "react";
import { ActionFeedbackForm } from "@/components/shared/action-feedback-form";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";

type PersonOption = { id: string; firstName: string; lastName: string };
type EventTypeOption = { value: string; label: string };

export function MatchEventForm({
  action,
  locale,
  homeTeamName,
  awayTeamName,
  clubSide,
  allPlayers,
  startingPlayers,
  substitutePlayers,
  staff,
  eventTypes,
  defaultMinute,
  labels,
  successMessage,
  errorMessage
}: {
  action: (formData: FormData) => Promise<unknown>;
  locale: string;
  homeTeamName: string;
  awayTeamName: string;
  clubSide: "HOME" | "AWAY";
  allPlayers: PersonOption[];
  startingPlayers: PersonOption[];
  substitutePlayers: PersonOption[];
  staff: PersonOption[];
  eventTypes: EventTypeOption[];
  defaultMinute: number;
  labels: {
    minute: string;
    type: string;
    side: string;
    player: string;
    playerName: string;
    playerNameFr: string;
    participant: string;
    staff: string;
    add: string;
    playerPlaceholder: string;
    playerArabicPlaceholder: string;
    playerFrenchPlaceholder: string;
    staffOption: string;
  };
  successMessage: string;
  errorMessage: string;
}) {
  const isArabic = locale === "ar";
  const [side, setSide] = useState<"HOME" | "AWAY">(clubSide);
  const [type, setType] = useState("");
  const [entityType, setEntityType] = useState("PLAYER");
  const [playerId, setPlayerId] = useState("");
  const [outPlayerId, setOutPlayerId] = useState("");
  const isClubEvent = side === clubSide;
  const isOpponentStaffEvent = !isClubEvent && entityType === "STAFF";

  const eligiblePlayers = allPlayers;
  const isSubstitution = type === "SUBSTITUTION_IN" || type === "SUBSTITUTION_OUT";
  const visibleEventTypes = eventTypes
    .filter((option) => option.value !== "SUBSTITUTION_OUT")
    .map((option) => option.value === "SUBSTITUTION_IN" ? { ...option, label: isArabic ? "تبديل لاعب" : "Remplacement" } : option);

  return (
    <ActionFeedbackForm
      action={action}
      successMessage={successMessage}
      errorMessage={errorMessage}
      className="grid min-w-0 grid-cols-1 gap-4 rounded-2xl border border-border/70 bg-background/40 p-4 2xl:grid-cols-4"
    >
      <div>
        <label className="mb-1.5 block text-xs font-bold text-muted-foreground">{labels.minute}</label>
        <input name="minute" type="number" min={0} max={130} defaultValue={defaultMinute} required className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm" />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-bold text-muted-foreground">{labels.type}</label>
        <FormSelect name="type" value={type} required locale={locale} ariaLabel={labels.type} onValueChange={(value) => { setType(value); setPlayerId(""); setOutPlayerId(""); }} options={visibleEventTypes} />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-bold text-muted-foreground">{labels.side}</label>
        <FormSelect
          name="side"
          value={side}
          locale={locale}
          ariaLabel={labels.side}
          onValueChange={(value) => { setSide(value as "HOME" | "AWAY"); setPlayerId(""); }}
          options={[{ value: "HOME", label: homeTeamName }, { value: "AWAY", label: awayTeamName }]}
        />
      </div>
      {isSubstitution ? <div className="grid min-w-0 grid-cols-1 gap-3 rounded-xl border border-club-primary/20 bg-club-primary/[0.035] p-3 sm:col-span-2 sm:grid-cols-2">
        {isClubEvent ? <>
          <div className="min-w-0"><label className="mb-1.5 block text-xs font-bold text-muted-foreground">{isArabic ? "اللاعب الخارج" : "Joueur sortant"}</label><FormSelect name="outPlayerId" value={outPlayerId} required locale={locale} ariaLabel={isArabic ? "اللاعب الخارج" : "Joueur sortant"} placeholder={labels.playerPlaceholder} onValueChange={setOutPlayerId} options={[{ value: "", label: "—" }, ...startingPlayers.map((player) => ({ value: player.id, label: `${player.firstName} ${player.lastName}` }))]} /></div>
          <div className="min-w-0"><label className="mb-1.5 block text-xs font-bold text-muted-foreground">{isArabic ? "اللاعب الداخل" : "Joueur entrant"}</label><FormSelect name="playerId" value={playerId} required locale={locale} ariaLabel={isArabic ? "اللاعب الداخل" : "Joueur entrant"} placeholder={labels.playerPlaceholder} onValueChange={setPlayerId} options={[{ value: "", label: "—" }, ...substitutePlayers.filter((player) => player.id !== outPlayerId).map((player) => ({ value: player.id, label: `${player.firstName} ${player.lastName}` }))]} /></div>
        </> : <>
          <label className="min-w-0 text-xs font-bold text-muted-foreground">{isArabic ? "اللاعب الخارج" : "Joueur sortant"}<input name="outPlayerName" maxLength={120} required className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm" /></label>
          <label className="min-w-0 text-xs font-bold text-muted-foreground">{isArabic ? "اللاعب الداخل" : "Joueur entrant"}<input name="playerName" maxLength={120} required className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm" /></label>
        </>}
      </div> : <div>
        <label className="mb-1.5 block text-xs font-bold text-muted-foreground">{labels.player}</label>
        <FormSelect
          name="playerId"
          value={playerId}
          disabled={!isClubEvent || entityType !== "PLAYER"}
          locale={locale}
          ariaLabel={labels.player}
          placeholder={labels.playerPlaceholder}
          onValueChange={setPlayerId}
          options={[{ value: "", label: "—" }, ...eligiblePlayers.map((player) => ({ value: player.id, label: `${player.firstName} ${player.lastName}` }))]}
        />
      </div>}
      {!isSubstitution && entityType === "PLAYER" && (
        <>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-muted-foreground">{labels.playerName}</label>
            <input name="playerName" maxLength={120} autoComplete="off" required={!isClubEvent && !playerId} disabled={isClubEvent && Boolean(playerId)} className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm disabled:opacity-60" placeholder={isArabic ? labels.playerArabicPlaceholder : labels.playerPlaceholder} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-muted-foreground">{labels.playerNameFr}</label>
            <input name="playerNameFr" maxLength={120} autoComplete="off" dir="ltr" disabled={isClubEvent && Boolean(playerId)} className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-start text-sm disabled:opacity-60" placeholder={labels.playerFrenchPlaceholder} />
          </div>
        </>
      )}
      {!isSubstitution && <div>
        <label className="mb-1.5 block text-xs font-bold text-muted-foreground">{labels.participant}</label>
        <FormSelect
          name="entityType"
          value={entityType}
          locale={locale}
          ariaLabel={labels.participant}
          onValueChange={(value) => { setEntityType(value); setPlayerId(""); }}
          options={[{ value: "PLAYER", label: isArabic ? "لاعب" : "Joueur" }, { value: "STAFF", label: labels.staffOption }]}
        />
      </div>}
      {!isSubstitution && <div>
        {!isClubEvent && entityType === "STAFF" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-muted-foreground">{isOpponentStaffEvent ? labels.staff : labels.playerName}</label>
              <input name="playerName" maxLength={120} autoComplete="off" dir="rtl" required className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm" placeholder={isOpponentStaffEvent ? (isArabic ? "اسم عضو الطاقم" : "Nom en arabe") : labels.playerArabicPlaceholder} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-muted-foreground">{labels.playerNameFr}</label>
              <input name="playerNameFr" maxLength={120} autoComplete="off" dir="ltr" className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-start text-sm" placeholder={labels.playerFrenchPlaceholder} />
            </div>
          </div>
        ) : isClubEvent && entityType === "STAFF" ? (
          <>
            <label className="mb-1.5 block text-xs font-bold text-muted-foreground">{labels.staff}</label>
            <FormSelect name="staffId" defaultValue="" disabled={entityType !== "STAFF"} locale={locale} ariaLabel={labels.staff} placeholder="—" options={[{ value: "", label: "—" }, ...staff.map((member) => ({ value: member.id, label: `${member.firstName} ${member.lastName}` }))]} />
          </>
        ) : null}
      </div>}
      <div className="flex justify-end sm:col-span-2 2xl:col-span-4">
        <Button type="submit" className="h-10 min-w-44 gap-2 rounded-xl">{labels.add}</Button>
      </div>
    </ActionFeedbackForm>
  );
}
