import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { getCurrentTeamId, getAuthorizedTeams, getAuthorizedTeamIds } from "@/lib/team-context";
import { createCorrespondenceAction } from "../actions";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { FormSelect } from "@/components/ui/form-select";
import { Save,  Send, ArrowRight, ArrowLeft, Upload, FileText, Building2, User, Users, Trophy } from "lucide-react";

async function suggestReferenceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.correspondence.count({ where: { date: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) } } });
  return `ESH-${year}-${String(count + 1).padStart(4, "0")}`;
}

export default async function NewCorrespondencePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isAr = locale === "ar";
  const Arrow = isAr ? ArrowRight : ArrowLeft;
  await requirePermission("correspondence.manage");
  const t = await getTranslations("correspondence");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");

  const authorizedTeamIds = await getAuthorizedTeamIds();
  const [teams, players, staff, matches, suggestedRef, currentTeamId] = await Promise.all([
    getAuthorizedTeams(),
    db.player.findMany({ where: { status: { not: "ARCHIVED" }, teamId: { in: authorizedTeamIds } }, orderBy: { lastName: "asc" } }),
    db.staff.findMany({ where: { status: "ACTIVE", teamId: { in: authorizedTeamIds } }, orderBy: { lastName: "asc" } }),
    db.match.findMany({ where: { teamId: { in: authorizedTeamIds } }, orderBy: { matchDate: "desc" }, take: 30 }),
    suggestReferenceNumber(),
    getCurrentTeamId()
  ]);

  async function action(formData: FormData) {
    "use server";
    const { id } = await createCorrespondenceAction(formData);
    redirect(`/${locale}/dashboard/correspondence/${id}`);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Centered Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-club-primary/10 text-club-primary border border-club-primary/20">
            <Send className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
              {t("addCorrespondence")}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isAr
                ? "تسجيل وأرشفة المراسلات الإدارية الرسمية الصادرة والواردة للنادي"
                : "Enregistrement et archivage du courrier administratif officiel du club"}
            </p>
          </div>
        </div>

        <Link href={`/${locale}/dashboard/correspondence`}>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs font-semibold">
            <Arrow className="h-3.5 w-3.5" />
            <span>{isAr ? "الرجوع للمراسلات" : "Retour"}</span>
          </Button>
        </Link>
      </div>

      {/* Main Form */}
      <form action={action} className="space-y-5">
        {/* Section 1: Core Details */}
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
          <div className="border-b border-border/60 pb-2 mb-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-club-primary" />
              <span>{isAr ? "1. بيانات المراسلة الأساسية" : "1. Données du courrier"}</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-bold text-foreground">{t("fields.referenceNumber")} *</label>
              <input
                name="referenceNumber"
                defaultValue={suggestedRef}
                required
                className="w-full font-mono rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-bold focus:border-club-primary focus:ring-1 focus:ring-club-primary"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-foreground">{t("fields.type")} *</label>
              <FormSelect
                name="type"
                locale={locale}
                defaultValue="INCOMING"
                required
                options={[
                  { value: "INCOMING", label: t("incoming") },
                  { value: "OUTGOING", label: t("outgoing") }
                ]}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-bold text-foreground">{t("fields.subject")} *</label>
              <input
                name="subject"
                placeholder={isAr ? "موضوع الخطاب أو المراسلة..." : "Objet du courrier..."}
                required
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold focus:border-club-primary focus:ring-1 focus:ring-club-primary"
              />
            </div>

            <div>
              <DateInput
                label={t("fields.date")}
                name="date"
                required
                defaultValue={new Date()}
                locale={locale}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-foreground">{t("fields.priority")}</label>
              <FormSelect
                name="priority"
                locale={locale}
                defaultValue="NORMAL"
                options={["LOW", "NORMAL", "HIGH", "URGENT"].map((p) => ({
                  value: p,
                  label: t(`priorities.${p}` as any)
                }))}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Parties and Categorization */}
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
          <div className="border-b border-border/60 pb-2 mb-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4 text-club-primary" />
              <span>{isAr ? "2. أطراف المراسلة والتوجيه" : "2. Expéditeur & Destinataire"}</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-bold text-foreground">{t("fields.sender")} *</label>
              <input
                name="sender"
                placeholder={isAr ? "الجهة أو الشخص المرسل..." : "Expéditeur..."}
                required
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs focus:border-club-primary focus:ring-1 focus:ring-club-primary"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-foreground">{t("fields.recipient")} *</label>
              <input
                name="recipient"
                placeholder={isAr ? "الجهة أو الشخص المستقبل..." : "Destinataire..."}
                required
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs focus:border-club-primary focus:ring-1 focus:ring-club-primary"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-foreground">{tTeams("title")}</label>
              <FormSelect
                name="teamId"
                locale={locale}
                defaultValue={currentTeamId ?? ""}
                options={[
                  { value: "", label: isAr ? "كافة الفئات / عام للنادي" : "Toutes catégories" },
                  ...teams.map((tm) => ({
                    value: tm.id,
                    label: tTeams(`categories.${tm.category}` as any)
                  }))
                ]}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-foreground">{t("fields.status")}</label>
              <FormSelect
                name="status"
                locale={locale}
                defaultValue="NEW"
                options={["NEW", "IN_PROGRESS", "COMPLETED", "ARCHIVED"].map((s) => ({
                  value: s,
                  label: t(`statuses.${s}` as any)
                }))}
              />
            </div>
          </div>
        </div>

        {/* Section 3: Optional Entities Linking */}
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
          <div className="border-b border-border/60 pb-2 mb-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-club-primary" />
              <span>{isAr ? "3. الارتباط الرياضي والتنظيمي (اختياري)" : "3. Liaisons opérationnelles"}</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-xs font-bold text-foreground">{t("fields.relatedPlayer")}</label>
              <FormSelect
                name="relatedPlayerId"
                locale={locale}
                placeholder={t("none")}
                options={[
                  { value: "", label: t("none") },
                  ...players.map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}` }))
                ]}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-foreground">{t("fields.relatedStaff")}</label>
              <FormSelect
                name="relatedStaffId"
                locale={locale}
                placeholder={t("none")}
                options={[
                  { value: "", label: t("none") },
                  ...staff.map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` }))
                ]}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-foreground">{t("fields.relatedMatch")}</label>
              <FormSelect
                name="relatedMatchId"
                locale={locale}
                placeholder={t("none")}
                options={[
                  { value: "", label: t("none") },
                  ...matches.map((m) => ({ value: m.id, label: `${m.homeTeamName} – ${m.awayTeamName}` }))
                ]}
              />
            </div>
          </div>
        </div>

        {/* Section 4: File Upload & Notes */}
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
          <div className="border-b border-border/60 pb-2 mb-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Upload className="h-4 w-4 text-club-primary" />
              <span>{isAr ? "4. المرفق الرقمي والملاحظات" : "4. Pièce jointe & Notes"}</span>
            </h2>
          </div>

          <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-4">
            <label className="mb-1 block text-xs font-bold text-foreground">
              {isAr ? "إرفاق الوثيقة أو الخطاب الرسمي (PDF / صورة / مستند)" : "Joindre le document scanné"}
            </label>
            <p className="mb-3 text-[11px] text-muted-foreground">
              {isAr ? "صيغ مدعومة: PDF, PNG, JPG, DOCX (الحجم الأقصى 10 ميغابايت)" : "Formats acceptés : PDF, PNG, JPG, DOCX (Max 10 Mo)"}
            </p>
            <input
              name="file"
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs file:me-3 file:rounded-lg file:border-0 file:bg-club-primary/10 file:px-3 file:py-1 file:text-xs file:font-bold file:text-club-primary hover:file:bg-club-primary/20 cursor-pointer"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-foreground">{t("fields.notes")}</label>
            <textarea
              name="notes"
              rows={3}
              placeholder={isAr ? "ملاحظات إضافية أو ملخص المراسلة..." : "Notes complémentaires..."}
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs focus:border-club-primary focus:ring-1 focus:ring-club-primary"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href={`/${locale}/dashboard/correspondence`}>
            <Button type="button" variant="outline" className="px-5 text-xs font-semibold">
              {tCommon("cancel")}
            </Button>
          </Link>
          <Button type="submit" className="px-6 text-xs font-bold shadow-md gap-2"><Save className="h-4 w-4" /><span>{tCommon("save")}</span></Button>
        </div>
      </form>
    </div>
  );
}
