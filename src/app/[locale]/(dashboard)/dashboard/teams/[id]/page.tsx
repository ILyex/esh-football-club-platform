import Link from "next/link";
import { ArrowLeft, Save, UsersRound } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { updateTeamAction } from "../actions";
import { Button } from "@/components/ui/button";
import { NoticeToast } from "@/components/shared/notice-toast";
import { redirect } from "next/navigation";
import { localizedClubName } from "@/lib/public/locale-text";

export default async function TeamEditPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams?: Promise<{ notice?: string }>;
}) {
  const { id, locale } = await params;
  const { notice } = (await searchParams) ?? {};
  await requirePagePermission("teams.manage", locale);
  const t = await getTranslations("teams");
  const tCommon = await getTranslations("common");

  const team = await db.team.findUnique({ where: { id } });
  if (!team) notFound();

  // Team rows represent the four canonical categories. Their stored labels may
  // have been entered in Arabic, so use the locale catalog when editing them
  // in French instead of showing Arabic text inside an otherwise French form.
  const localizedCategoryName = t(`categories.${team.category}` as any);
  const frenchTeamName = localizedClubName(
    team.name,
    locale,
    `Espoir Sidi Hosni — ${localizedCategoryName}`
  );
  const frenchShortName = localizedClubName(team.shortName, locale, localizedCategoryName);

  async function update(formData: FormData) {
    "use server";
    try {
      await updateTeamAction(id, formData);
    } catch {
      redirect(`/${locale}/dashboard/teams/${id}?notice=errors.teamSaveFailed`);
    }
    redirect(`/${locale}/dashboard/teams/${id}?notice=teamSaved`);
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <NoticeToast notice={notice} />
      <header className="rounded-2xl border border-border bg-card px-5 py-5 shadow-xs sm:px-7">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-club-primary/20 bg-club-primary/10 text-club-primary">
            <UsersRound className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-club-primary">{t(`categories.${team.category}` as any)}</p>
            <h1 className="mt-0.5 text-xl font-bold tracking-tight text-foreground">{t("editTeam")}</h1>
            <p className="mt-1 truncate text-sm text-muted-foreground">{localizedClubName(team.name, locale, t(`categories.${team.category}` as any))}</p>
          </div>
          <span className="hidden rounded-lg border border-border bg-muted/40 px-2.5 py-1 font-mono text-[11px] text-muted-foreground sm:inline-flex">{team.category}</span>
        </div>
      </header>

      <form action={update} className="grid grid-cols-1 gap-x-5 gap-y-5 rounded-2xl border border-border bg-card p-5 shadow-xs sm:grid-cols-2 sm:p-7">
        <div className="sm:col-span-2 border-b border-border/70 pb-3">
          <h2 className="text-sm font-bold text-foreground">{t("editTeam")}</h2>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="team-name" className="mb-1.5 block text-xs font-semibold text-foreground">{t("fields.name")}</label>
          <input id="team-name" name="name" defaultValue={locale === "fr" ? frenchTeamName : team.name} maxLength={80} required className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground outline-none transition focus:border-club-primary focus:ring-2 focus:ring-club-primary/15" />
        </div>
        <div>
          <label htmlFor="team-short-name" className="mb-1.5 block text-xs font-semibold text-foreground">{t("fields.shortName")}</label>
          <input id="team-short-name" name="shortName" defaultValue={locale === "fr" ? frenchShortName : team.shortName ?? ""} maxLength={40} className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground outline-none transition focus:border-club-primary focus:ring-2 focus:ring-club-primary/15" />
        </div>
        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 px-3.5 text-sm transition-colors hover:bg-muted/40">
          <span className="font-medium text-foreground">{t("fields.active")}</span>
          <input type="hidden" name="active" value="false" />
          <input name="active" type="checkbox" defaultChecked={team.active} className="h-4 w-4 accent-club-primary" />
        </label>
        <div>
          <label htmlFor="birth-year-from" className="mb-1.5 block text-xs font-semibold text-foreground">{t("fields.birthYearFrom")}</label>
          <input
            id="birth-year-from"
            name="birthYearFrom"
            type="number"
            min={1900}
            max={2100}
            step={1}
            defaultValue={team.birthYearFrom ?? ""}
            className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground outline-none transition focus:border-club-primary focus:ring-2 focus:ring-club-primary/15"
          />
        </div>
        <div>
          <label htmlFor="birth-year-to" className="mb-1.5 block text-xs font-semibold text-foreground">{t("fields.birthYearTo")}</label>
          <input
            id="birth-year-to"
            name="birthYearTo"
            type="number"
            min={1900}
            max={2100}
            step={1}
            defaultValue={team.birthYearTo ?? ""}
            className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground outline-none transition focus:border-club-primary focus:ring-2 focus:ring-club-primary/15"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="team-description" className="mb-1.5 block text-xs font-semibold text-foreground">{t("fields.description")}</label>
          <textarea id="team-description" name="description" rows={4} maxLength={1000} defaultValue={team.description ?? ""} className="w-full resize-y rounded-xl border border-border bg-background px-3.5 py-3 text-sm text-foreground outline-none transition focus:border-club-primary focus:ring-2 focus:ring-club-primary/15" />
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-border/70 pt-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
          <Link href={`/${locale}/dashboard/teams`} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            <span>{tCommon("back")}</span>
          </Link>
          <Button type="submit" className="h-10 gap-2 rounded-xl px-5 text-sm font-bold shadow-xs"><Save className="h-4 w-4" /><span>{tCommon("save")}</span></Button>
        </div>
      </form>
    </div>
  );
}
