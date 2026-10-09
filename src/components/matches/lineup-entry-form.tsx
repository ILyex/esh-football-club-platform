"use client";

import { useMemo, useState } from "react";
import { FormSelect } from "@/components/ui/form-select";
import { Button } from "@/components/ui/button";
import { UserCheck } from "lucide-react";

type PlayerOption = {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  status: string;
  redCardWarning?: string;
};

interface LineupEntryFormProps {
  locale: string;
  players: PlayerOption[];
  addPlayerLabel: string;
  playerLabel: string;
  positionLabel: string;
  statusLabel: string;
}

const POSITION_OPTIONS = ["GOALKEEPER", "DEFENDER", "MIDFIELDER", "FORWARD"] as const;
const STATUS_OPTIONS = ["STARTING", "SUBSTITUTE", "INJURED", "SUSPENDED", "NOT_CALLED"] as const;

export function LineupEntryForm({ locale, players, addPlayerLabel, playerLabel, positionLabel, statusLabel }: LineupEntryFormProps) {
  const isAr = locale === "ar";
  const [playerId, setPlayerId] = useState("");
  const [position, setPosition] = useState("");
  const [selectionStatus, setSelectionStatus] = useState<(typeof STATUS_OPTIONS)[number]>("STARTING");
  const selectedPlayer = players.find((player) => player.id === playerId);

  const positionOptions = useMemo(() => POSITION_OPTIONS.map((value) => ({
    value,
    label: isAr
      ? (({ GOALKEEPER: "حارس مرمى", DEFENDER: "مدافع", MIDFIELDER: "وسط ميدان", FORWARD: "مهاجم" } as Record<string, string>)[value] ?? value)
      : (({ GOALKEEPER: "Gardien", DEFENDER: "Défenseur", MIDFIELDER: "Milieu", FORWARD: "Attaquant" } as Record<string, string>)[value] ?? value)
  })), [isAr]);

  const statusOptions = STATUS_OPTIONS.map((value) => ({
    value,
    label: isAr
      ? (({ STARTING: "أساسي", SUBSTITUTE: "احتياط", INJURED: "مصاب", SUSPENDED: "موقوف", NOT_CALLED: "غير مستدعى" } as Record<string, string>)[value] ?? value)
      : (({ STARTING: "Titulaire", SUBSTITUTE: "Remplaçant", INJURED: "Blessé", SUSPENDED: "Suspendu", NOT_CALLED: "Non convoqué" } as Record<string, string>)[value] ?? value)
  }));

  return (
    <>
      <input type="hidden" name="isStarting" value={selectionStatus === "STARTING" ? "true" : "false"} />
      <div>
        <label className="mb-1.5 block text-xs font-bold text-muted-foreground">{playerLabel}</label>
        <FormSelect
          name="playerId"
          required
          locale={locale}
          ariaLabel={playerLabel}
          onValueChange={(nextPlayerId) => {
            setPlayerId(nextPlayerId);
            const nextPlayer = players.find((player) => player.id === nextPlayerId);
            setPosition(nextPlayer?.position ?? "");
          }}
          options={players.map((player) => ({
            value: player.id,
            label: `${player.firstName} ${player.lastName}${player.status === "INJURED" ? ` — ${isAr ? "مصاب" : "Blessé"}` : player.status === "SUSPENDED" ? ` — ${isAr ? "موقوف" : "Suspendu"}` : ""}`,
            warning: player.redCardWarning
          }))}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-bold text-muted-foreground">{positionLabel}</label>
        <FormSelect name="position" value={position} required locale={locale} ariaLabel={positionLabel} onValueChange={setPosition} placeholder={isAr ? "اختر المركز" : "Choisir le poste"} options={positionOptions} />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-bold text-muted-foreground">{statusLabel}</label>
        <FormSelect name="selectionStatus" value={selectionStatus} locale={locale} ariaLabel={statusLabel} onValueChange={(value) => setSelectionStatus(value as (typeof STATUS_OPTIONS)[number])} options={statusOptions} />
      </div>
      <Button type="submit" className="h-10 gap-2 rounded-xl">
        <UserCheck className="h-4 w-4" aria-hidden="true" />
        {addPlayerLabel}
      </Button>
    </>
  );
}
