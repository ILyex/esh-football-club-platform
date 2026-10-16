"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Copy, List, Pencil, Trash2 } from "lucide-react";
import { deleteTacticalPlanAction, saveTacticalPlanAction } from "@/app/[locale]/(dashboard)/dashboard/tactics/actions";

type SavedPlan = {
  id: string;
  title: string;
  description: string;
  formation: string;
  teamId: string | null;
  teamName: string;
  creatorName: string;
  coachName: string;
  isOwner: boolean;
  data: unknown;
  updatedAt: string;
};

export function SavedTacticalPlans({ locale, canEdit, plans: initialPlans }: { locale: string; canEdit: boolean; plans: SavedPlan[] }) {
  const isAr = locale === "ar";
  const [plans, setPlans] = useState(initialPlans);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const editorUrl = (planId?: string) => `/${locale}/dashboard/tactics${planId ? `?plan=${encodeURIComponent(planId)}` : ""}`;
  const dateLabel = (value: string) => new Intl.DateTimeFormat(isAr ? "ar-DZ" : "fr-DZ", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Algiers",
    hourCycle: "h23"
  }).format(new Date(value));

  async function duplicate(plan: SavedPlan) {
    setBusyId(plan.id); setMessage("");
    try {
      const result = await saveTacticalPlanAction({
        title: `${plan.title} — ${isAr ? "نسخة" : "copie"}`,
        description: plan.description,
        formation: plan.formation,
        teamId: plan.teamId,
        data: JSON.stringify(plan.data)
      });
      const copy: SavedPlan = { ...plan, id: result.id, title: `${plan.title} — ${isAr ? "نسخة" : "copie"}`, creatorName: "", coachName: plan.coachName, isOwner: true, updatedAt: result.updatedAt };
      setPlans((current) => [copy, ...current]);
      setMessage(isAr ? "تم نسخ الخطة." : "Plan dupliqué.");
    } catch {
      setMessage(isAr ? "تعذر نسخ الخطة." : "Impossible de dupliquer le plan.");
    } finally { setBusyId(null); }
  }

  async function remove(plan: SavedPlan) {
    if (!window.confirm(isAr ? "حذف هذه الخطة نهائيًا؟" : "Supprimer définitivement ce plan ?")) return;
    setBusyId(plan.id); setMessage("");
    try {
      await deleteTacticalPlanAction(plan.id);
      setPlans((current) => current.filter((item) => item.id !== plan.id));
      setMessage(isAr ? "تم حذف الخطة." : "Plan supprimé.");
    } catch {
      setMessage(isAr ? "تعذر حذف الخطة." : "Impossible de supprimer le plan.");
    } finally { setBusyId(null); }
  }

  return <main dir={isAr ? "rtl" : "ltr"} className="mx-auto max-w-5xl space-y-4 pb-8">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3"><span className="rounded-lg bg-club-primary/10 p-2 text-club-primary"><List size={20}/></span><div><h1 className="text-xl font-bold">{isAr ? "الخطط المحفوظة" : "Plans enregistrés"}</h1><p className="mt-1 text-sm text-muted-foreground">{isAr ? "كل خطة مع تاريخها واسم المدرب." : "Chaque plan avec sa date et le nom de l’entraîneur."}</p></div></div>
      <Link href={editorUrl()} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:border-club-primary"><ArrowLeft size={16}/>{isAr ? "العودة إلى السبورة" : "Retour au tableau"}</Link>
    </header>
    {message && <p role="status" className="rounded-lg border border-border bg-card px-4 py-3 text-sm">{message}</p>}
    {plans.length === 0 ? <section className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">{isAr ? "لا توجد خطط محفوظة بعد." : "Aucun plan enregistré pour le moment."}</section> : <section className="space-y-3">
      {plans.map((plan) => {
        const mayManage = canEdit && (Boolean(plan.teamId) || plan.isOwner);
        return <article key={plan.id} className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-club-primary/60">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0"><h2 className="truncate text-lg font-bold">{plan.title}</h2><p className="mt-1 text-sm text-muted-foreground">{plan.teamName || plan.formation}</p></div>
            <Link href={editorUrl(plan.id)} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-club-primary px-3 py-2 text-sm font-semibold text-white hover:brightness-110"><Pencil size={15}/>{isAr ? "فتح الخطة" : "Ouvrir le plan"}</Link>
          </div>
          <dl className="mt-4 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
            <div><dt className="text-xs text-muted-foreground">{isAr ? "التاريخ" : "Date"}</dt><dd className="mt-1 text-sm font-medium">{dateLabel(plan.updatedAt)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{isAr ? "المدرب" : "Entraîneur"}</dt><dd className="mt-1 text-sm font-medium">{plan.coachName || plan.creatorName || "—"}</dd></div>
          </dl>
          {mayManage && <div className="mt-3 flex gap-2 border-t border-border pt-3">
            <button type="button" onClick={() => void duplicate(plan)} disabled={busyId !== null} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-club-primary disabled:opacity-50"><Copy size={14}/>{isAr ? "نسخ" : "Dupliquer"}</button>
            <button type="button" onClick={() => void remove(plan)} disabled={busyId !== null} className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50"><Trash2 size={14}/>{isAr ? "حذف" : "Supprimer"}</button>
          </div>}
        </article>;
      })}
    </section>}
  </main>;
}
