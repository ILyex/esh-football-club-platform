import { formatAlgeriaDateTimeLocalized } from "@/lib/dates/algeria";
import { Save, Trash2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission, hasPermission, requiredPermissionForDocument } from "@/lib/permissions";
import { getMutationScopeContext, assertTeamScope } from "@/lib/mutation-guards";
import { notFound, redirect } from "next/navigation";
import { updateDocumentMetadataAction, setDocumentStatusAction, deleteDocumentAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { localizedClubName } from "@/lib/public/locale-text";

const CLASSIFICATION_TONE = { PUBLIC: "success", INTERNAL: "neutral", RESTRICTED: "danger" } as const;
const STATUS_TONE = { PENDING_REVIEW: "warning", APPROVED: "success", ARCHIVED: "neutral" } as const;

export default async function DocumentDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const user = await requirePagePermission("documents.view", locale);
  const t = await getTranslations("documents");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");
  const canUpdate = hasPermission(user, "documents.update");
  const canDelete = hasPermission(user, "documents.delete");
  const canSeeRestricted = hasPermission(user, "documents.view.restricted");

  const document = await db.document.findUnique({
    where: { id },
    include: { category: true, team: true, relatedPlayer: true, relatedStaff: true, relatedMatch: true, uploadedBy: true, medicalRecord: { select: { id: true } } }
  });
  if (!document) notFound();
  // Same choke point as the list query and the download API route — a
  // direct-by-ID visit can never bypass classification (spec: never access
  // another team's restricted information merely by changing an ID in a URL).
  if (document.medicalRecord ? !hasPermission(user, "medical.records.view") : !hasPermission(user, requiredPermissionForDocument(document.classification))) notFound();

  // Team-scope authorization check
  const scopeContext = await getMutationScopeContext();
  try {
    assertTeamScope(scopeContext, document.teamId, "Document", { allowClubWide: true });
  } catch {
    notFound();
  }

  const [categories, teams, players, staff, matches] = await Promise.all([
    db.documentCategory.findMany({ orderBy: { name: "asc" } }),
    db.team.findMany({ orderBy: { category: "asc" } }),
    db.player.findMany({ where: { status: "ACTIVE" }, orderBy: { lastName: "asc" } }),
    db.staff.findMany({ where: { status: "ACTIVE" }, orderBy: { lastName: "asc" } }),
    db.match.findMany({ orderBy: { matchDate: "desc" }, take: 30 })
  ]);

  async function update(formData: FormData) {
    "use server";
    await updateDocumentMetadataAction(id, formData);
  }
  async function approve() {
    "use server";
    await setDocumentStatusAction(id, "APPROVED");
  }
  async function archive() {
    "use server";
    await setDocumentStatusAction(id, "ARCHIVED");
  }
  async function remove() {
    "use server";
    await deleteDocumentAction(id);
    redirect(`/${locale}/dashboard/documents`);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">{document.name}</h1>
        <Badge tone={CLASSIFICATION_TONE[document.classification]}>{t(`classification.${document.classification}` as any)}</Badge>
        <Badge tone={STATUS_TONE[document.status]}>{t(`statuses.${document.status}` as any)}</Badge>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        <p>
          {t("fields.originalName")}: {document.originalName} ({(document.sizeBytes / 1024).toFixed(0)} KB)
        </p>
        <p>
          {tCommon("date")}: {formatAlgeriaDateTimeLocalized(document.createdAt, locale, { dateStyle: "long", timeStyle: "short" })}
        </p>
        <p>{document.uploadedBy.name}</p>
      </div>

      {document.description === "verification:DRUG_TEST_POSITIVE" && (
        <div role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm font-medium text-amber-900 dark:text-amber-200">
          {locale === "ar"
            ? "تنبيه سري: رُصدت نتيجة فحص إيجابية آلياً. الوثيقة قيد المراجعة؛ يجب تأكيد النتيجة من مختص قبل اتخاذ أي قرار."
            : "Alerte confidentielle : résultat positif détecté automatiquement. Le document est en cours de vérification ; un spécialiste doit confirmer le résultat avant toute décision."}
        </div>
      )}

      <form action={update} className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-6">
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.name")}</label>
          <input name="name" defaultValue={document.name} disabled={!canUpdate} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.category")}</label>
          <select name="categoryId" defaultValue={document.categoryId} disabled={!canUpdate} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60">
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{tCommon("status")}</label>
          <select
            name="classification"
            defaultValue={document.classification}
            disabled={!canUpdate || (document.classification !== "RESTRICTED" && !canSeeRestricted)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          >
            <option value="PUBLIC">{t("classification.PUBLIC")}</option>
            <option value="INTERNAL">{t("classification.INTERNAL")}</option>
            {canSeeRestricted && <option value="RESTRICTED">{t("classification.RESTRICTED")}</option>}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{tTeams("title")}</label>
          <select name="teamId" defaultValue={document.teamId ?? ""} disabled={!canUpdate} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60">
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
          <input name="department" defaultValue={document.department ?? ""} disabled={!canUpdate} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">{t("fields.relatedPlayer")}</label>
          <select name="relatedPlayerId" defaultValue={document.relatedPlayerId ?? ""} disabled={!canUpdate} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60">
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
          <select name="relatedStaffId" defaultValue={document.relatedStaffId ?? ""} disabled={!canUpdate} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60">
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
          <select name="relatedMatchId" defaultValue={document.relatedMatchId ?? ""} disabled={!canUpdate} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60">
            <option value="">—</option>
            {matches.map((m) => (
              <option key={m.id} value={m.id}>
                {localizedClubName(m.homeTeamName, locale, locale === "ar" ? "الفريق" : "Club")} – {localizedClubName(m.awayTeamName, locale, locale === "ar" ? "الفريق" : "Club")}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">{t("fields.description")}</label>
          <textarea name="description" rows={3} defaultValue={document.description === "verification:DRUG_TEST_POSITIVE" ? "" : document.description ?? ""} disabled={!canUpdate} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60" />
        </div>
        {canUpdate && (
          <div className="col-span-2">
            <Button type="submit" className="gap-2"><Save className="h-4 w-4" /><span>{tCommon("save")}</span></Button>
          </div>
        )}
      </form>

      <div className="flex flex-wrap gap-2">
        <a href={`/api/documents/${document.id}/download`} className="inline-block rounded-md bg-club-primary px-4 py-2 text-sm font-medium text-white">
          {tCommon("download")}
        </a>
        {canUpdate && document.status !== "APPROVED" && (
          <form action={approve}>
            <Button type="submit" variant="outline">
              {t("approve")}
            </Button>
          </form>
        )}
        {canUpdate && document.status !== "ARCHIVED" && (
          <form action={archive}>
            <Button type="submit" variant="outline">
              {t("archive")}
            </Button>
          </form>
        )}
        {canDelete && (
          <ConfirmDialog onConfirm={remove}>
          <Button variant="destructive" className="gap-2 rounded-xl font-bold">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            <span>{tCommon("delete")}</span>
          </Button>
          </ConfirmDialog>
        )}
      </div>
    </div>
  );
}
