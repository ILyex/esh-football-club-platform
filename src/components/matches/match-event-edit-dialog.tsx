"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";

type EventOption = { value: string; label: string };
type PersonOption = { id: string; label: string };

export function MatchEventEditDialog({
  locale,
  event,
  homeTeamName,
  awayTeamName,
  clubSide,
  eventTypes,
  players,
  staff,
  action
}: {
  locale: string;
  event: { id: string; type: string; side: "HOME" | "AWAY"; minute: number; playerId: string | null; staffId: string | null; playerName: string | null; playerNameFr: string | null };
  homeTeamName: string;
  awayTeamName: string;
  clubSide: "HOME" | "AWAY";
  eventTypes: EventOption[];
  players: PersonOption[];
  staff: PersonOption[];
  action: (formData: FormData) => Promise<unknown>;
}) {
  const isAr = locale === "ar";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [side, setSide] = useState(event.side);
  const [entityType, setEntityType] = useState(event.staffId ? "STAFF" : "PLAYER");
  const isOurSide = side === clubSide;

  async function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      await action(new FormData(formEvent.currentTarget));
      toast.success(isAr ? "تم تحديث الحدث بنجاح." : "Événement mis à jour.");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (isAr ? "تعذر تحديث الحدث." : "Impossible de modifier l’événement."));
    } finally {
      setPending(false);
    }
  }

  return <>
    <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 px-2.5 text-xs" onClick={() => { setSide(event.side); setEntityType(event.staffId ? "STAFF" : "PLAYER"); setOpen(true); }}>
      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{isAr ? "تعديل" : "Modifier"}</span>
    </Button>
    {open && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget && !pending) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby={`edit-event-${event.id}`} dir={isAr ? "rtl" : "ltr"} className="w-full max-w-2xl overflow-visible rounded-2xl border border-border bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id={`edit-event-${event.id}`} className="text-base font-bold">{isAr ? "تعديل حدث المباراة" : "Modifier l’événement"}</h2>
          <button type="button" aria-label={isAr ? "إغلاق" : "Fermer"} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" disabled={pending} onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
        </header>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs font-semibold text-muted-foreground">
            <span>{isAr ? "الدقيقة" : "Minute"}</span>
            <input name="minute" type="number" min={0} max={130} required defaultValue={event.minute} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-club-primary" />
          </label>
          <div className="space-y-1.5 text-xs font-semibold text-muted-foreground">
            <span>{isAr ? "نوع الحدث" : "Type d’événement"}</span>
            <FormSelect name="type" defaultValue={event.type} locale={locale} ariaLabel={isAr ? "نوع الحدث" : "Type d’événement"} options={eventTypes} />
          </div>
          <div className="space-y-1.5 text-xs font-semibold text-muted-foreground">
            <span>{isAr ? "الفريق" : "Équipe"}</span>
            <FormSelect name="side" value={side} locale={locale} ariaLabel={isAr ? "الفريق" : "Équipe"} onValueChange={(value) => setSide(value as "HOME" | "AWAY")} options={[{ value: "HOME", label: homeTeamName }, { value: "AWAY", label: awayTeamName }]} />
          </div>
          <div className="space-y-1.5 text-xs font-semibold text-muted-foreground">
            <span>{isAr ? "نوع صاحب الحدث" : "Participant"}</span>
            <FormSelect name="entityType" value={entityType} locale={locale} ariaLabel={isAr ? "نوع صاحب الحدث" : "Participant"} onValueChange={setEntityType} options={[{ value: "PLAYER", label: isAr ? "لاعب" : "Joueur" }, { value: "STAFF", label: isAr ? "عضو طاقم" : "Membre du staff" }]} />
          </div>
          {entityType === "PLAYER" && isOurSide ? <div className="space-y-1.5 text-xs font-semibold text-muted-foreground sm:col-span-2">
            <span>{isAr ? "اللاعب" : "Joueur"}</span>
            <FormSelect name="playerId" defaultValue={event.playerId ?? ""} required locale={locale} ariaLabel={isAr ? "اللاعب" : "Joueur"} options={[{ value: "", label: isAr ? "اختر اللاعب" : "Choisir un joueur" }, ...players.map((player) => ({ value: player.id, label: player.label }))]} />
          </div> : null}
          {entityType === "STAFF" && isOurSide ? <div className="space-y-1.5 text-xs font-semibold text-muted-foreground sm:col-span-2">
            <span>{isAr ? "عضو الطاقم" : "Membre du staff"}</span>
            <FormSelect name="staffId" defaultValue={event.staffId ?? ""} required locale={locale} ariaLabel={isAr ? "عضو الطاقم" : "Membre du staff"} options={[{ value: "", label: isAr ? "اختر عضو الطاقم" : "Choisir un membre" }, ...staff.map((member) => ({ value: member.id, label: member.label }))]} />
          </div> : null}
          {!isOurSide || (entityType === "STAFF" && !event.staffId) ? <>
            <label className="space-y-1.5 text-xs font-semibold text-muted-foreground">
              <span>{entityType === "STAFF" ? (isAr ? "اسم عضو الطاقم" : "Nom du membre") : (isAr ? "اسم اللاعب" : "Nom du joueur")}</span>
              <input name="playerName" maxLength={120} required defaultValue={event.playerName ?? ""} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-club-primary" />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-muted-foreground">
              <span>{isAr ? "الاسم بالفرنسية (اختياري)" : "Nom en français (facultatif)"}</span>
              <input name="playerNameFr" maxLength={120} dir="ltr" defaultValue={event.playerNameFr ?? ""} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-start text-sm text-foreground outline-none focus:border-club-primary" />
            </label>
          </> : null}
          <footer className="flex justify-end gap-2 border-t border-border pt-4 sm:col-span-2">
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>{isAr ? "إلغاء" : "Annuler"}</Button>
            <Button type="submit" disabled={pending} className="gap-2"><Save className="h-4 w-4" aria-hidden="true" />{pending ? (isAr ? "جارٍ الحفظ…" : "Enregistrement…") : (isAr ? "حفظ التعديل" : "Enregistrer")}</Button>
          </footer>
        </form>
      </section>
    </div>}
  </>;
}
