import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { createContractAction } from "../actions";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, FileCheck, ShieldCheck } from "lucide-react";
import { ContractForm } from "@/components/contracts/contract-form";

const TYPES = ["PROFESSIONAL", "AMATEUR", "LOAN", "STAFF"] as const;
const STATUSES = ["PENDING", "ACTIVE", "EXPIRING_SOON", "EXPIRED"] as const;

export default async function NewContractPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  await requirePermission("contracts.manage");
  const t = await getTranslations("contracts");
  const tTeams = await getTranslations("teams");
  const tStaff = await getTranslations("staff");
  const tCommon = await getTranslations("common");

  const [players, staff] = await Promise.all([
    db.player.findMany({
      where: { status: { not: "ARCHIVED" } },
      include: { team: true },
      orderBy: { lastName: "asc" }
    }),
    db.staff.findMany({
      where: { status: { not: "ARCHIVED" } },
      orderBy: { lastName: "asc" }
    })
  ]);

  async function action(formData: FormData) {
    "use server";
    const { id } = await createContractAction(formData);
    redirect(`/${locale}/dashboard/contracts/${id}`);
  }

  const isAr = locale === "ar";
  const BackIcon = isAr ? ArrowRight : ArrowLeft;

  const playerOptions = players.map((p) => ({
    id: p.id,
    name: `${p.firstName} ${p.lastName}`,
    categoryName: p.team ? tTeams(`categories.${p.team.category}` as any) : undefined
  }));

  const staffOptions = staff.map((s) => ({
    id: s.id,
    name: `${s.firstName} ${s.lastName}`,
    subtitle: s.role ? tStaff(`roles.${s.role}` as any) : undefined
  }));

  const typesMap: Record<string, string> = {};
  TYPES.forEach((ty) => {
    typesMap[ty] = t(`types.${ty}` as any);
  });

  const statusesMap: Record<string, string> = {};
  STATUSES.forEach((st) => {
    statusesMap[st] = t(`statuses.${st}` as any);
  });

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
              <h1 className="text-xl font-bold tracking-tight text-foreground">{t("addContract")}</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isAr
                ? "تسجيل عقد رياضي أو إداري جديد للاعب أو عضو طاقم وتوثيقه في السجل الرسمي"
                : "Enregistrer un nouveau contrat sportif ou administratif dans les archives officielles"}
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>{isAr ? "نظام العقود المعتمد" : "Système de contrats certifié"}</span>
        </div>
      </div>

      {/* ── Contract Creation Form ── */}
      <ContractForm
        locale={locale}
        players={playerOptions}
        staff={staffOptions}
        action={action}
        types={TYPES}
        statuses={STATUSES}
        translations={{
          title: t("title"),
          addContract: t("addContract"),
          typeLabel: t("fields.type"),
          statusLabel: tCommon("status"),
          playerLabel: t("fields.player"),
          staffLabel: t("fields.staff"),
          startDateLabel: t("fields.startDate"),
          endDateLabel: t("fields.endDate"),
          notesLabel: t("fields.notes"),
          save: tCommon("save"),
          cancel: tCommon("cancel"),
          none: t("none"),
          typesMap,
          statusesMap
        }}
      />
    </div>
  );
}
