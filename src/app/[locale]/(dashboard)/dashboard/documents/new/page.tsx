import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { getCurrentTeamId } from "@/lib/team-context";
import { uploadDocumentAction } from "../actions";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";

export default async function NewDocumentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await requirePermission("documents.create");
  const t = await getTranslations("documents");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");
  const canSetRestricted = hasPermission(user, "documents.view.restricted");

  const [categories, teams, players, staff, matches, currentTeamId] = await Promise.all([
    db.documentCategory.findMany({ orderBy: { name: "asc" } }),
    db.team.findMany({ orderBy: { category: "asc" } }),
    db.player.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { lastName: "asc" } }),
    db.staff.findMany({ where: { status: "ACTIVE" }, orderBy: { lastName: "asc" } }),
    db.match.findMany({ orderBy: { matchDate: "desc" }, take: 30 }),
    getCurrentTeamId()
  ]);

  async function action(formData: FormData) {
    "use server";
    const { id } = await uploadDocumentAction(formData);
    redirect(`/${locale}/dashboard/documents/${id}`);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold">{t("uploadDocument")}</h1>
      <form action={action} className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border border-border bg-card p-4 sm:p-6 shadow-xs">
        <div className="col-span-1 md:col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.file")}</label>
          <input name="file" type="file" required className="w-full text-sm" />
        </div>
        <div className="col-span-1 md:col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.name")}</label>
          <input name="name" required className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.category")}</label>
          <select name="categoryId" required className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{tCommon("status")}</label>
          <select name="classification" defaultValue="INTERNAL" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="PUBLIC">{t("classification.PUBLIC")}</option>
            <option value="INTERNAL">{t("classification.INTERNAL")}</option>
            {canSetRestricted && <option value="RESTRICTED">{t("classification.RESTRICTED")}</option>}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{tTeams("title")}</label>
          <select name="teamId" defaultValue={currentTeamId ?? ""} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="">—</option>
            {teams.map((tm) => (
              <option key={tm.id} value={tm.id}>
                {tTeams(`categories.${tm.category}` as any)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.department")}</label>
          <input name="department" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <DateInput
            label={t("fields.documentDate")}
            name="documentDate"
            locale={locale}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.relatedPlayer")}</label>
          <select name="relatedPlayerId" defaultValue="" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="">—</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.relatedStaff")}</label>
          <select name="relatedStaffId" defaultValue="" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="">—</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.relatedMatch")}</label>
          <select name="relatedMatchId" defaultValue="" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="">—</option>
            {matches.map((m) => (
              <option key={m.id} value={m.id}>
                {m.homeTeamName} – {m.awayTeamName}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-1 md:col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.description")}</label>
          <textarea name="description" rows={3} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="col-span-1 md:col-span-2">
          <Button type="submit">{t("uploadDocument")}</Button>
        </div>
      </form>
    </div>
  );
}
