"use client";

import { useMemo, useState } from "react";
import { Ban, ChevronDown, HeartPulse, Plus, UserCheck, UserRoundX, Users } from "lucide-react";
import { FormSelect } from "@/components/ui/form-select";

type Player = { id: string; firstName: string; lastName: string; position: string | null; status: string; teamId: string | null };
type Entry = { playerId: string; position: string; selectionStatus: "STARTING" | "SUBSTITUTE" | "INJURED" | "SUSPENDED" | "NOT_CALLED" };

const positions = ["GOALKEEPER", "DEFENDER", "MIDFIELDER", "FORWARD"] as const;
const statuses = ["STARTING", "SUBSTITUTE", "INJURED", "SUSPENDED", "NOT_CALLED"] as const;

export function NewMatchLineup({ players, teamId, locale }: { players: Player[]; teamId: string; locale: string }) {
  const isAr = locale === "ar";
  const [entries, setEntries] = useState<Entry[]>([]);
  const [playerId, setPlayerId] = useState("");
  const [position, setPosition] = useState("");
  const [selectionStatus, setSelectionStatus] = useState<Entry["selectionStatus"]>("STARTING");
  const availablePlayers = players.filter((player) => player.teamId === teamId);
  const selected = availablePlayers.find((player) => player.id === playerId);
  const labels = isAr
    ? { STARTING: "أساسي", SUBSTITUTE: "احتياط", INJURED: "مصاب", SUSPENDED: "موقوف", NOT_CALLED: "غير مستدعى" }
    : { STARTING: "Titulaire", SUBSTITUTE: "Remplaçant", INJURED: "Blessé", SUSPENDED: "Suspendu", NOT_CALLED: "Non convoqué" };
  const positionLabels = isAr
    ? { GOALKEEPER: "حارس مرمى", DEFENDER: "مدافع", MIDFIELDER: "وسط ميدان", FORWARD: "مهاجم" }
    : { GOALKEEPER: "Gardien", DEFENDER: "Défenseur", MIDFIELDER: "Milieu", FORWARD: "Attaquant" };
  const statusCards = [
    { status: "STARTING", Icon: UserCheck, tone: "border-emerald-500/20 bg-emerald-500/5 text-emerald-500" },
    { status: "SUBSTITUTE", Icon: Users, tone: "border-sky-500/20 bg-sky-500/5 text-sky-500" },
    { status: "INJURED", Icon: HeartPulse, tone: "border-amber-500/20 bg-amber-500/5 text-amber-500" },
    { status: "SUSPENDED", Icon: Ban, tone: "border-red-500/20 bg-red-500/5 text-red-500" },
    { status: "NOT_CALLED", Icon: UserRoundX, tone: "border-slate-500/20 bg-slate-500/5 text-slate-500" }
  ] as const;
  const counts = useMemo(() => statuses.reduce((result, status) => ({ ...result, [status]: entries.filter((entry) => entry.selectionStatus === status).length }), {} as Record<string, number>), [entries]);

  const addEntry = () => {
    if (!selected || !position || entries.some((entry) => entry.playerId === playerId)) return;
    setEntries((current) => [...current, { playerId, position, selectionStatus }]);
    setPlayerId("");
    setPosition("");
    setSelectionStatus("STARTING");
  };

  return (
    <details className="group rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
      <input type="hidden" name="lineupEntries" value={JSON.stringify(entries)} />
      <summary className="mb-5 flex cursor-pointer list-none items-center justify-between border-b border-border/70 pb-4 marker:hidden">
        <div>
          <h2 className="text-base font-bold text-foreground">{isAr ? "التشكيلة" : "Composition"}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{isAr ? "أضف اللاعبين وحالتهم مباشرة أثناء برمجة المباراة." : "Ajoutez les joueurs et leur statut dès la programmation."}</p>
        </div>
        <span className="flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-blue-400" aria-hidden="true" />
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
        </span>
      </summary>
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {statusCards.map(({ status, Icon, tone }) => (
          <div key={status} className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 ${tone}`}>
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="text-xs text-muted-foreground"><strong className="me-1 text-base text-foreground">{counts[status] ?? 0}</strong>{labels[status]}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 items-end gap-3 rounded-xl border border-border/70 bg-background/40 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <FormSelect name="newLineupPlayer" value={playerId} locale={locale} ariaLabel={isAr ? "اللاعب" : "Joueur"} placeholder={isAr ? "اختر اللاعب" : "Choisir le joueur"} onValueChange={(value) => { setPlayerId(value); setPosition(availablePlayers.find((player) => player.id === value)?.position ?? ""); }} options={availablePlayers.filter((player) => !entries.some((entry) => entry.playerId === player.id)).map((player) => ({ value: player.id, label: `${player.firstName} ${player.lastName}` }))} />
        <FormSelect name="newLineupPosition" value={position} locale={locale} ariaLabel={isAr ? "المركز" : "Poste"} placeholder={isAr ? "اختر المركز" : "Choisir le poste"} onValueChange={setPosition} options={positions.map((value) => ({ value, label: positionLabels[value] }))} />
        <FormSelect name="newLineupStatus" value={selectionStatus} locale={locale} ariaLabel={isAr ? "حالة اللاعب" : "Statut"} onValueChange={(value) => setSelectionStatus(value as Entry["selectionStatus"])} options={statuses.map((value) => ({ value, label: labels[value] }))} />
        <button type="button" onClick={addEntry} disabled={!selected || !position} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-club-primary px-4 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4" />{isAr ? "إضافة اللاعب" : "Ajouter le joueur"}</button>
      </div>
      {entries.length > 0 && <ul className="mt-4 space-y-2">{entries.map((entry) => { const player = players.find((item) => item.id === entry.playerId); return <li key={entry.playerId} className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-sm"><span>{player?.firstName} {player?.lastName} <span className="text-muted-foreground">— {positionLabels[entry.position as keyof typeof positionLabels]} · {labels[entry.selectionStatus]}</span></span><button type="button" onClick={() => setEntries((current) => current.filter((item) => item.playerId !== entry.playerId))} className="text-xs font-semibold text-destructive hover:underline">{isAr ? "حذف" : "Supprimer"}</button></li>; })}</ul>}
    </details>
  );
}
