import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions";
import { assertTeamScope, getMutationScopeContext } from "@/lib/mutation-guards";
import { updatePlayerMedicalRecordAction } from "../../actions";
import { ArrowRight, FileHeart, Save } from "lucide-react";
import { FormSelect } from "@/components/ui/form-select";

const allowedTypes = ["MEDICAL_CLEARANCE", "DRUG_TEST_RESULT", "LAB_ANALYSIS"];

export default async function EditPlayerMedicalFilePage({ params, searchParams }: { params: Promise<{ locale: string; playerId: string }>; searchParams: Promise<{ updated?: string }> }) {
  const { locale, playerId } = await params;
  const notice = await searchParams;
  const user = await requirePagePermission("medical.records.manage", locale);
  const scope = await getMutationScopeContext();
  const player = await db.player.findUnique({ where: { id: playerId }, include: { team: { select: { name: true, category: true } }, medicalRecords: { where: { type: { in: allowedTypes as any } }, include: { document: { select: { originalName: true, status: true } } }, orderBy: { createdAt: "desc" } } } });
  if (!player) notFound();
  try { assertTeamScope(scope, player.teamId, "Player", { allowClubWide: true }); } catch { notFound(); }
  const isAr = locale === "ar";
  const medicalInputClass = "h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground shadow-2xs outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-club-primary focus:ring-2 focus:ring-club-primary/15";
  const name = isAr ? `${player.firstName} ${player.lastName}` : `${player.firstNameFr || player.firstName} ${player.lastNameFr || player.lastName}`;
  const labels: Record<string, string> = isAr ? { MEDICAL_CLEARANCE: "الأهلية الطبية لكرة القدم", DRUG_TEST_RESULT: "كشف تعاطي المخدرات", LAB_ANALYSIS: "التحاليل الطبية" } : { MEDICAL_CLEARANCE: "Aptitude médicale", DRUG_TEST_RESULT: "Dépistage de consommation de drogues", LAB_ANALYSIS: "Analyses médicales" };
  const statuses: Record<string, string> = isAr ? { PENDING: "بانتظار المراجعة", FIT: "مؤهل طبياً", TEMPORARILY_UNFIT: "غير مؤهل مؤقتاً", UNFIT: "غير مؤهل", NOT_APPLICABLE: "غير منطبق" } : { PENDING: "En attente", FIT: "Apte médicalement", TEMPORARILY_UNFIT: "Inapte temporairement", UNFIT: "Inapte", NOT_APPLICABLE: "Non applicable" };
  const asInputDate = (date: Date | null) => date ? date.toISOString().slice(0, 10) : "";
  return <main className="mx-auto max-w-5xl space-y-5" dir={isAr ? "rtl" : "ltr"}>
    <header className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <Link href={`/${locale}/dashboard/medical-records/${player.id}`} className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-primary"><ArrowRight className="h-4 w-4" />{isAr ? "العودة إلى الملف الطبي" : "Retour au dossier médical"}</Link>
      <div className="mt-4 flex items-center gap-3"><span className="rounded-xl bg-primary/10 p-3 text-primary"><FileHeart className="h-6 w-6" /></span><div><h1 className="text-xl font-black">{isAr ? "تعديل الملف الطبي" : "Modifier le dossier médical"}</h1><p className="mt-1 text-sm text-muted-foreground">{name} · {player.team?.name || (isAr ? "بدون فئة" : "Sans catégorie")}</p></div></div>
    </header>
    {notice.updated === "1" && <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-600">{isAr ? "تم تحديث بيانات الملف بنجاح." : "Le dossier a été mis à jour."}</p>}
    <section className="space-y-4">
      {player.medicalRecords.map((record) => <form key={record.id} action={updatePlayerMedicalRecordAction.bind(null, record.id, locale)} className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3"><div><h2 className="font-bold">{labels[record.type] || record.type}</h2><p className="mt-1 text-xs text-muted-foreground">{record.document?.originalName || (isAr ? "لم يُرفق ملف" : "Aucun fichier")}</p></div><span className="rounded-full bg-muted px-3 py-1 text-xs">{record.document?.status === "APPROVED" ? (isAr ? "معتمدة" : "Validé") : (isAr ? "بانتظار اعتماد المستخدم" : "Validation humaine en attente")}</span></div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="flex min-w-0 flex-col gap-2 text-sm"><span className="block leading-5 font-semibold">{isAr ? "اسم الوثيقة" : "Nom du document"}</span><input name="title" required maxLength={120} defaultValue={record.title} className={medicalInputClass} /></label><label className="flex min-w-0 flex-col gap-2 text-sm"><span className="block leading-5 font-semibold">{isAr ? "الجهة المصدرة" : "Émetteur"}</span><input name="provider" maxLength={120} defaultValue={record.provider || ""} className={medicalInputClass} /></label>
          <label className="flex min-w-0 flex-col gap-2 text-sm"><span className="block leading-5 font-semibold">{isAr ? "تاريخ الإصدار" : "Date d’émission"}</span><input type="date" name="issuedAt" lang={isAr ? "ar-DZ" : "fr-DZ"} dir="ltr" defaultValue={asInputDate(record.issuedAt)} className={medicalInputClass} /></label><label className="flex min-w-0 flex-col gap-2 text-sm"><span className="block leading-5 font-semibold">{isAr ? "تاريخ الانتهاء" : "Date d’expiration"}</span><input type="date" name="expiresAt" lang={isAr ? "ar-DZ" : "fr-DZ"} dir="ltr" defaultValue={asInputDate(record.expiresAt)} className={medicalInputClass} /></label>
          {record.type === "MEDICAL_CLEARANCE" && <label className="flex min-w-0 flex-col gap-2 text-sm"><span className="block leading-5 font-semibold">{isAr ? "حالة الأهلية الطبية" : "Statut d’aptitude"}</span><FormSelect name="status" defaultValue={record.status} locale={locale} ariaLabel={isAr ? "حالة الأهلية الطبية" : "Statut d’aptitude"} options={Object.entries(statuses).map(([value, label]) => ({ value, label }))} /></label>}
        </div><button className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"><Save className="h-4 w-4" />{isAr ? "حفظ التعديلات" : "Enregistrer"}</button>
      </form>)}
      {!player.medicalRecords.length && <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">{isAr ? "لا توجد وثائق لتعديلها. أضف وثيقة من صفحة الملف الطبي." : "Aucun document à modifier. Ajoutez un document depuis le dossier médical."}</div>}
    </section>
  </main>;
}
