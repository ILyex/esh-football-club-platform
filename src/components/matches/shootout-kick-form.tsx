"use client";

import { useState } from "react";
import { FormSelect } from "@/components/ui/form-select";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

type Player = { id: string; firstName: string; lastName: string };

export function ShootoutKickForm({
  locale,
  homeTeamName,
  awayTeamName,
  clubSide,
  players,
  available
}: {
  locale: string;
  homeTeamName: string;
  awayTeamName: string;
  clubSide: "HOME" | "AWAY";
  players: Player[];
  available: boolean;
}) {
  const isAr = locale === "ar";
  const [side, setSide] = useState<"HOME" | "AWAY">(clubSide);
  const [playerId, setPlayerId] = useState("");
  const [playerName, setPlayerName] = useState("");

  return (
    <div className="grid min-w-0 grid-cols-1 items-end gap-3 rounded-xl border border-border/70 bg-background/40 p-3 sm:grid-cols-2">
      <div>
        <label className="mb-1.5 block text-xs font-bold text-muted-foreground">{isAr ? "الفريق" : "Équipe"}</label>
        <FormSelect name="side" value={side} disabled={!available} locale={locale} ariaLabel={isAr ? "الفريق" : "Équipe"} onValueChange={(value) => { const nextSide = value as "HOME" | "AWAY"; setSide(nextSide); setPlayerId(""); setPlayerName(""); }} options={[{ value: "HOME", label: homeTeamName }, { value: "AWAY", label: awayTeamName }]} />
      </div>
      {side === clubSide ? (
        <div>
          <label className="mb-1.5 block text-xs font-bold text-muted-foreground">{isAr ? "اللاعب" : "Joueur"}</label>
          <FormSelect name="playerId" required value={playerId} disabled={!available} locale={locale} ariaLabel={isAr ? "اللاعب" : "Joueur"} placeholder={isAr ? "اختر اللاعب" : "Choisir le joueur"} onValueChange={(value) => { const player = players.find((item) => item.id === value); setPlayerId(value); setPlayerName(player ? `${player.firstName} ${player.lastName}` : ""); }} options={players.map((player) => ({ value: player.id, label: `${player.firstName} ${player.lastName}` }))} />
          <input type="hidden" name="playerName" value={playerName} />
        </div>
      ) : (
        <div>
          <label className="mb-1.5 block text-xs font-bold text-muted-foreground">{isAr ? "اسم اللاعب" : "Nom du joueur"}</label>
          <input name="playerName" required value={playerName} disabled={!available} onChange={(event) => setPlayerName(event.target.value)} placeholder={isAr ? "اسم لاعب الخصم" : "Nom du joueur adverse"} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm disabled:opacity-60" />
          <input type="hidden" name="playerId" value="" />
        </div>
      )}
      <div>
        <label className="mb-1.5 block text-xs font-bold text-muted-foreground">{isAr ? "نتيجة الركلة" : "Résultat du tir"}</label>
        <FormSelect name="result" defaultValue="SCORED" disabled={!available} locale={locale} ariaLabel={isAr ? "نتيجة الركلة" : "Résultat du tir"} options={[{ value: "SCORED", label: isAr ? "سجل" : "Marqué" }, { value: "MISSED", label: isAr ? "أضاع" : "Manqué" }]} />
      </div>
      <Button type="submit" disabled={!available} className="h-10 w-full min-w-0 gap-2 whitespace-nowrap rounded-xl px-3 text-sm sm:col-span-2"><Plus className="h-4 w-4 shrink-0" />{isAr ? "إضافة الركلة" : "Ajouter le tir"}</Button>
    </div>
  );
}
