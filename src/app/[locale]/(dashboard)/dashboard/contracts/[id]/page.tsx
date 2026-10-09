import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { getMutationScopeContext, assertTeamScope } from "@/lib/mutation-guards";
import { notFound, redirect } from "next/navigation";
import { updateContractAction, archiveContractAction } from "../actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DateInput } from "@/components/ui/date-input";
import Link from "next/link";
import {
  FileCheck,
  User,
  Users,
  Calendar,
  Save,
  Trash2,
  ArrowRight,
  ArrowLeft,
  FileText,
  Clock,
  ShieldAlert
} from "lucide-react";

const TYPES = ["PROFESSIONAL", "AMATEUR", "LOAN", "STAFF"] as const;
const STATUSES = ["PENDING", "ACTIVE", "EXPIRING_SOON", "EXPIRED"] as const;

export default async function ContractDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const user = await requirePagePermission("contracts.view", locale);
  const t = await getTranslations("contracts");
  const tTeams = await getTranslations("teams");
  const tStaff = await getTranslations("staff");
  const tCommon = await getTranslations("common");

  const contract = await db.contract.findUnique({
    where: { id },
    include: {
      player: { include: { team: true } },
      staff: true,
      team: true,
      document: true
    }
  });
  if (!contract) notFound();

  const scopeContext = await getMutationScopeContext();
  try {
    assertTeamScope(scopeContext, contract.teamId, "Contract", { allowClubWide: true });
  } catch {
    notFound();
  }

  const canManage = hasPermission(user, "contracts.manage");
  const isAr = locale === "ar";
  const BackIcon = isAr ? ArrowRight : ArrowLeft;

  const isPlayer = Boolean(contract.player);
  const subjectName = contract.player
    ? `${contract.player.firstName} ${contract.player.lastName}`
    : contract.staff
      ? `${contract.staff.firstName} ${contract.staff.lastName}`
      : "—";

  const subjectRole = contract.player
    ? (contract.player.team ? tTeams(`categories.${contract.player.team.category}` as any) : "لاعب")
    : contract.staff
      ? (contract.staff.role ? tStaff(`roles.${contract.staff.role}` as any) : "طاقم")
      : "—";

  const { playerId, staffId } = contract;

  async function update(formData: FormData) {
    "use server";
    if (playerId) formData.set("playerId", playerId);
    if (staffId) formData.set("staffId", staffId);
    await updateContractAction(id, formData);
  }

  async function archive() {
    "use server";
    await archiveContractAction(id);
    redirect(`/${locale}/dashboard/contracts`);
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}/dashboard/contracts`}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <BackIcon className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-club-primary/10 text-club-primary">
                <FileCheck className="h-3.5 w-3.5" />
              </span>
              <h1 className="text-xl font-bold tracking-tight text-foreground">{subjectName}</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {subjectRole} • {t(`types.${contract.type}` as any)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Main Form ── */}
      <form action={update} className="space-y-6">
        {/* Subject Card (Read-only bound) */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${
              isPlayer ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            }`}>
              {isPlayer ? <User className="h-5 w-5" /> : <Users className="h-5 w-5" />}
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {isPlayer ? (isAr ? "اللاعب المتعاقد" : "Joueur sous contrat") : (isAr ? "عضو الطاقم المتعاقد" : "Membre du staff sous contrat")}
              </span>
              <p className="text-base font-bold text-foreground">{subjectName}</p>
              <p className="text-xs text-muted-foreground">{subjectRole}</p>
            </div>
          </div>

          {contract.document && (
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg border border-border/80">
              <FileText className="h-3.5 w-3.5 text-club-primary" />
              <span>{contract.document.name}</span>
            </div>
          )}
        </div>

        {/* Contract Terms */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-foreground pb-2 border-b border-border/80">
            {isAr ? "بنود وصلاحية العقد" : "Clauses et validité du contrat"}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t("fields.type")}
              </label>
              <select
                name="type"
                defaultValue={contract.type}
                disabled={!canManage}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-medium disabled:opacity-60"
              >
                {TYPES.map((ty) => (
                  <option key={ty} value={ty}>
                    {t(`types.${ty}` as any)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {tCommon("status")}
              </label>
              <select
                name="status"
                defaultValue={contract.status}
                disabled={!canManage}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-medium disabled:opacity-60"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`statuses.${s}` as any)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <DateInput
                label={t("fields.startDate")}
                name="startDate"
                defaultValue={contract.startDate}
                disabled={!canManage}
                locale={locale}
              />
            </div>

            <div>
              <DateInput
                label={t("fields.endDate")}
                name="endDate"
                defaultValue={contract.endDate}
                disabled={!canManage}
                locale={locale}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t("fields.notes")}
            </label>
            <textarea
              name="notes"
              rows={3}
              defaultValue={contract.notes ?? ""}
              disabled={!canManage}
              className="w-full rounded-xl border border-border bg-background p-3 text-sm disabled:opacity-60 focus:border-club-primary focus:ring-1 focus:ring-club-primary"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {canManage && (
            <Button
              type="submit"
              className="bg-club-primary hover:bg-club-primary-hover text-white font-medium flex items-center gap-2 px-6 shadow-xs"
            >
              <Save className="h-4 w-4" />
              <span>{tCommon("save")}</span>
            </Button>
          )}

          {canManage && contract.status !== "EXPIRED" && (
            <ConfirmDialog
              title={isAr ? "فسخ أو أرشفة العقد" : "Résilier ou archiver le contrat"}
              body={isAr ? "هل أنت متأكد من أرشفة هذا العقد؟ لن يتم حذفه من السجلات التاريخية بل ستتغير حالته إلى منتهٍ." : "Êtes-vous sûr de vouloir archiver ce contrat ?"}
              onConfirm={archive}
            >
              <Button
                type="button"
                variant="destructive"
                className="bg-red-600 hover:bg-red-700 text-white font-medium flex items-center gap-2 px-5 shadow-xs cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                <span>{isAr ? "أرشفة العقد" : "Archiver le contrat"}</span>
              </Button>
            </ConfirmDialog>
          )}
        </div>
      </form>
    </div>
  );
}
