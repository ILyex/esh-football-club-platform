import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { assertTeamScope, getMutationScopeContext } from "@/lib/mutation-guards";
import { approveMedicalDocumentAction, createPlayerMedicalRecordAction, updateMedicalClearanceStatusAction } from "../actions";
import { ArrowRight, BadgeCheck, FileHeart, FileText, Save, Upload } from "lucide-react";
import { FormSelect } from "@/components/ui/form-select";

const recordTypes = [
  ["MEDICAL_CLEARANCE", "الأهلية الطبية لكرة القدم", "Aptitude médicale au football"],
  ["DRUG_TEST_RESULT", "كشف تعاطي المخدرات", "Dépistage de consommation de drogues"],
  ["LAB_ANALYSIS", "التحاليل الطبية", "Analyses médicales"]
] as const;

export default async function PlayerMedicalFilePage({ params, searchParams }: { params: Promise<{ locale: string; playerId: string }>; searchParams: Promise<{ saved?: string; updated?: string }> }) {
  const { locale, playerId } = await params;
  const notice = await searchParams;
  const user = await requirePagePermission("medical.records.view", locale);
  const canManage = hasPermission(user, "medical.records.manage");
  const scope = await getMutationScopeContext();
  const player = await db.player.findUnique({
    where: { id: playerId },
    include: {
      team: { select: { name: true, category: true } },
      medicalRecords: { where: { type: { in: ["MEDICAL_CLEARANCE", "DRUG_TEST_RESULT", "LAB_ANALYSIS"] } }, include: { document: { select: { id: true, originalName: true, createdAt: true, status: true } } }, orderBy: [{ createdAt: "desc" }] }
    }
  });
  if (!player) notFound();
  try { assertTeamScope(scope, player.teamId, "Player", { allowClubWide: true }); } catch { notFound(); }
  const isAr = locale === "ar";
  const medicalInputClass = "h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground shadow-2xs outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-club-primary focus:ring-2 focus:ring-club-primary/15";
  const heading = isAr ? `${player.firstName} ${player.lastName}` : `${player.firstNameFr || player.firstName} ${player.lastNameFr || player.lastName}`;
  const formAction = createPlayerMedicalRecordAction.bind(null, player.id);
  const statusName: Record<string, string> = isAr ? {
    PENDING: "بانتظار المراجعة", FIT: "مؤهل طبياً", TEMPORARILY_UNFIT: "غير مؤهل مؤقتاً", UNFIT: "غير مؤهل", NOT_APPLICABLE: "غير منطبق"
  } : {
    PENDING: "En attente", FIT: "Apte médicalement", TEMPORARILY_UNFIT: "Inapte temporairement", UNFIT: "Inapte", NOT_APPLICABLE: "Non applicable"
  };
  const typeName = (type: string) => {
    const item = recordTypes.find(([key]) => key === type);
    return item ? (isAr ? item[1] : item[2]) : type;
  };
  const documentCheckName: Record<string, string> = isAr ? {
    QUEUED: "قيد الفحص الآلي بالخلفية",
    CHECKED: "اجتاز الفحص الإداري الأولي — بانتظار اعتماد المختص",
    NEEDS_REVIEW: "يتطلب مراجعة بشرية",
    UNAVAILABLE: "تعذر الفحص الآلي — يلزم التحقق يدوياً"
  } : {
    QUEUED: "Vérification automatique en attente",
    CHECKED: "Contrôle administratif initial effectué — validation humaine requise",
    NEEDS_REVIEW: "Vérification humaine requise",
    UNAVAILABLE: "Contrôle automatique indisponible — vérifier manuellement"
  };
  const findingName: Record<string, string> = isAr ? {
    TYPE_MATCH: "نوع الوثيقة يبدو مطابقاً",
    TYPE_UNCLEAR: "نوع الوثيقة غير واضح آلياً",
    TYPE_MISMATCH: "نوع الوثيقة قد لا يطابق التصنيف",
    IDENTITY_MATCH: "اسم اللاعب يبدو مطابقاً",
    IDENTITY_UNCLEAR: "تعذر التأكد آلياً من اسم اللاعب",
    IDENTITY_MISMATCH: "اسم اللاعب قد لا يطابق الملف",
    ISSUE_DATE_PRESENT: "تاريخ الإصدار ظاهر",
    ISSUE_DATE_MISSING: "تعذر العثور على تاريخ الإصدار المُدخل",
    EXPIRY_DATE_PRESENT: "تاريخ الانتهاء ظاهر",
    EXPIRY_DATE_MISSING: "تعذر العثور على تاريخ الانتهاء المُدخل",
    DATES_UNCLEAR: "التواريخ تحتاج مراجعة",
    UNREADABLE: "تعذرت قراءة الوثيقة آلياً",
    BIRTH_DATE_MATCH: "تاريخ الميلاد متطابق",
    BIRTH_DATE_MISMATCH: "تاريخ الميلاد لا يطابق بيانات اللاعب",
    BIRTH_DATE_UNCLEAR: "تعذر التأكد من تاريخ الميلاد",
    MEDICAL_CONCERN_REVIEW: "مؤشر طبي مذكور صراحةً — يتطلب مراجعة مختص"
  } : {
    TYPE_MATCH: "Le type semble correspondre",
    TYPE_UNCLEAR: "Type de document incertain",
    TYPE_MISMATCH: "Le type pourrait ne pas correspondre",
    IDENTITY_MATCH: "Le nom du joueur semble correspondre",
    IDENTITY_UNCLEAR: "Identité du joueur non confirmée automatiquement",
    IDENTITY_MISMATCH: "Le nom pourrait ne pas correspondre au dossier",
    ISSUE_DATE_PRESENT: "Date d’émission visible",
    ISSUE_DATE_MISSING: "Date d’émission saisie introuvable",
    EXPIRY_DATE_PRESENT: "Date d’expiration visible",
    EXPIRY_DATE_MISSING: "Date d’expiration saisie introuvable",
    DATES_UNCLEAR: "Dates à vérifier",
    UNREADABLE: "Document illisible automatiquement",
    BIRTH_DATE_MATCH: "La date de naissance correspond",
    BIRTH_DATE_MISMATCH: "La date de naissance ne correspond pas au joueur",
    BIRTH_DATE_UNCLEAR: "Date de naissance non vérifiable",
    MEDICAL_CONCERN_REVIEW: "Anomalie explicitement signalée — avis médical requis"
  };
  const documentFindingsSummary = (value: unknown) => Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => findingName[item] || item).join(" · ")
    : "";
  const date = (value: Date | null) => value ? new Intl.DateTimeFormat(isAr ? "ar-DZ" : "fr-FR", { dateStyle: "medium", timeZone: "UTC" }).format(value) : (isAr ? "غير محدد" : "Non précisée");
  const pendingCount = player.medicalRecords.filter((record) => record.document?.status === "PENDING_REVIEW").length;
  const uploadedDocumentTypes = new Set(player.medicalRecords.filter((record) => record.document).map((record) => record.type));
  const documentCompletion = Math.round((recordTypes.filter(([type]) => uploadedDocumentTypes.has(type)).length / recordTypes.length) * 100);
  const progressHue = Math.round(documentCompletion * 1.2);
  const ringCircumference = 2 * Math.PI * 32;
  const clearance = player.medicalRecords.find((record) => record.type === "MEDICAL_CLEARANCE");
  const summaryCards = [
    { label: isAr ? "إجمالي الوثائق" : "Documents", value: player.medicalRecords.length, tone: "text-primary" },
    { label: isAr ? "بانتظار المراجعة" : "À vérifier", value: pendingCount, tone: pendingCount ? "text-amber-500" : "text-emerald-500" },
    { label: isAr ? "الأهلية الطبية" : "Aptitude", value: clearance ? statusName[clearance.status] : (isAr ? "غير مسجلة" : "Non renseignée"), tone: clearance?.status === "FIT" ? "text-emerald-500" : "text-muted-foreground" }
  ];
  return (
    <main className="mx-auto max-w-7xl space-y-5" dir={isAr ? "rtl" : "ltr"}>
      <header className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-5 p-5 sm:p-6">
          <div className="min-w-0">
            <Link href={`/${locale}/dashboard/medical-records`} className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground transition hover:text-primary"><ArrowRight className="h-4 w-4" />{isAr ? "العودة إلى الملفات الطبية" : "Retour aux dossiers médicaux"}</Link>
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative h-[76px] w-[76px] shrink-0" role="img" aria-label={isAr ? `اكتمال وثائق اللاعب ${documentCompletion}%` : `Documents du joueur complétés à ${documentCompletion}%`}>
                <svg viewBox="0 0 76 76" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true"><circle cx="38" cy="38" r="32" fill="none" className="stroke-border" strokeWidth="5" /><circle cx="38" cy="38" r="32" fill="none" stroke={`hsl(${progressHue} 76% 48%)`} strokeWidth="5" strokeLinecap="round" strokeDasharray={ringCircumference} strokeDashoffset={ringCircumference * (1 - documentCompletion / 100)} className="transition-all duration-500" /></svg>
                <div className="absolute inset-[7px] overflow-hidden rounded-full border border-border bg-muted">{player.photoUrl ? <img src={player.photoUrl} alt={heading} className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-sm font-black text-primary">{player.firstName.slice(0, 1)}{player.lastName.slice(0, 1)}</span>}</div>
                <span className="absolute -bottom-1 start-1/2 -translate-x-1/2 rounded-full border border-background bg-card px-1.5 py-0.5 text-[9px] font-black tabular-nums shadow-sm" style={{ color: `hsl(${progressHue} 76% 48%)` }}>{documentCompletion}%</span>
              </div>
              <div><h1 className="text-xl font-black sm:text-2xl">{isAr ? "الملف الطبي للاعب" : "Dossier médical du joueur"}</h1><p className="mt-1 text-sm text-muted-foreground">{heading}</p><p className="mt-1 text-[11px] text-muted-foreground">{isAr ? `${uploadedDocumentTypes.size} من ${recordTypes.length} وثائق مرفوعة` : `${uploadedDocumentTypes.size} document(s) sur ${recordTypes.length}`}</p></div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{player.team ? <span className="rounded-full border border-border px-3 py-1.5">{player.team.name || player.team.category}</span> : <span className="rounded-full border border-border px-3 py-1.5">{isAr ? "بدون فئة" : "Sans catégorie"}</span>}</div>
          </div>
        </div>
        <div className="grid border-t border-border bg-muted/20 sm:grid-cols-3">
          {summaryCards.map((item, index) => <div key={item.label} className={`flex items-center justify-between gap-3 px-5 py-3.5 ${index ? "border-t border-border sm:border-t-0 sm:border-s" : ""}`}><span className="text-xs text-muted-foreground">{item.label}</span><span className={`text-sm font-bold ${item.tone}`}>{item.value}</span></div>)}
        </div>
      </header>
      {(notice.saved === "1" || notice.updated === "1") && <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">{isAr ? "تم حفظ الملف الطبي وتسجيل العملية." : "Le dossier médical a été enregistré et l’opération journalisée."}</p>}

      <section className="grid items-stretch gap-4 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center gap-3 border-b border-border px-5 py-4"><span className="rounded-lg bg-primary/10 p-2 text-primary"><FileText className="h-4 w-4" /></span><div><h2 className="font-bold">{isAr ? "سجل الوثائق والفحوصات" : "Documents et examens"}</h2><p className="mt-0.5 text-xs text-muted-foreground">{isAr ? "الوثائق الطبية المرتبطة بهذا اللاعب" : "Documents médicaux de ce joueur"}</p></div><span className="ms-auto rounded-full bg-muted px-2.5 py-1 text-xs font-bold">{player.medicalRecords.length}</span></div>
          <div className="flex-1 divide-y divide-border">
            {player.medicalRecords.map((record) => (
              <article key={record.id} className="space-y-4 p-4 sm:p-5">
                <div className="flex min-w-0 items-start gap-3"><span className="mt-0.5 rounded-lg border border-border bg-muted/40 p-2 text-primary"><FileText className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{record.title}</h3><span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold">{typeName(record.type)}</span></div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{isAr ? "الإصدار" : "Émis le"}: {date(record.issuedAt)}</span><span>{isAr ? "الانتهاء" : "Expire le"}: {date(record.expiresAt)}</span><span>{isAr ? "الحالة" : "Statut"}: {statusName[record.status]}</span></div>
                  <div className="mt-3 rounded-xl border border-sky-500/20 bg-sky-500/5 p-3"><p className="text-xs font-semibold text-sky-700 dark:text-sky-300">{isAr ? "نتيجة الفحص الآلي" : "Résultat du contrôle automatisé"} · {documentCheckName[record.documentCheckStatus]}</p>{documentFindingsSummary(record.documentCheckFindings) && <p className="mt-1.5 text-xs text-muted-foreground">{documentFindingsSummary(record.documentCheckFindings)}</p>}<p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">{isAr ? "ينبه الذكاء الاصطناعي إلى مؤشرات الوثيقة والهوية أو ملاحظات طبية مذكورة صراحةً فقط. لا يشخّص ولا يعتمد الوثيقة؛ القرار للمستخدم المختص." : "L’IA signale les incohérences d’identité et les anomalies médicales explicitement mentionnées. Elle ne diagnostique ni ne valide le document : la décision appartient au spécialiste."}</p></div>
                  {record.consentAuthority && <p className="mt-2 text-xs text-muted-foreground">{isAr ? "الموافقة من" : "Consentement par"}: {record.consentAuthority === "LEGAL_GUARDIAN" ? `${isAr ? "الولي القانوني" : "représentant légal"}${record.consentAuthorityName ? ` — ${record.consentAuthorityName}` : ""}` : (isAr ? "اللاعب" : "joueur")}</p>}
                  {record.type === "MEDICAL_CLEARANCE" && canManage && <form action={updateMedicalClearanceStatusAction.bind(null, record.id, locale)} className="mt-3 flex flex-wrap gap-2"><div className="w-full max-w-56"><FormSelect name="status" defaultValue={record.status} locale={locale} compact ariaLabel={isAr ? "حالة الأهلية" : "Statut d’aptitude"} options={["PENDING", "FIT", "TEMPORARILY_UNFIT", "UNFIT"].map((status) => ({ value: status, label: statusName[status] || status }))} /></div><button className="h-9 rounded-lg border border-border px-3 text-xs font-bold transition hover:bg-muted">{isAr ? "تحديث الحالة" : "Mettre à jour"}</button></form>}</div></div>
                <div className="flex flex-wrap items-center gap-2 ps-11">{record.document?.status === "PENDING_REVIEW" && canManage && <form action={approveMedicalDocumentAction.bind(null, record.id, locale)}><button className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white transition hover:bg-emerald-700"><BadgeCheck className="h-4 w-4" />{isAr ? "اعتماد بعد المراجعة" : "Valider après vérification"}</button></form>}{record.document && <a href={`/api/documents/${record.document.id}/download?inline=true`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs font-bold transition hover:bg-muted"><BadgeCheck className="h-4 w-4" />{isAr ? "عرض الوثيقة" : "Ouvrir le document"}</a>}</div>
              </article>
            ))}
            {!player.medicalRecords.length && <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center"><span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><FileHeart className="h-5 w-5" /></span><p className="text-sm font-semibold">{isAr ? "لا توجد وثائق طبية مسجلة لهذا اللاعب بعد." : "Aucun document médical enregistré pour ce joueur."}</p><p className="mt-1 text-xs text-muted-foreground">{isAr ? "استخدم نموذج الإضافة لبدء بناء الملف الطبي." : "Utilisez le formulaire pour commencer le dossier médical."}</p></div>}
          </div>
        </div>

        {canManage ? <form id="medical-document-form" action={formAction} encType="multipart/form-data" className="min-w-0 space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start gap-3 border-b border-border pb-4"><span className="rounded-lg bg-primary/10 p-2 text-primary"><Upload className="h-4 w-4" /></span><div><h2 className="font-bold">{isAr ? "إضافة وثيقة إلى الملف" : "Ajouter un document"}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{isAr ? "ترفع الملفات إلى التخزين الخاص وتُربط بهذا اللاعب وحده." : "Le fichier est stocké de manière privée et lié uniquement à ce joueur."}</p></div></div>
          <input type="hidden" name="locale" value={locale} />
          <label className="flex min-w-0 flex-col gap-2 text-sm"><span className="block leading-5 font-semibold">{isAr ? "نوع الوثيقة" : "Type de document"}</span><FormSelect name="type" required locale={locale} ariaLabel={isAr ? "نوع الوثيقة" : "Type de document"} options={recordTypes.map(([value, ar, fr]) => ({ value, label: String(isAr ? ar : fr) }))} /></label>
          <label className="flex min-w-0 flex-col gap-2 text-sm"><span className="block leading-5 font-semibold">{isAr ? "اسم الوثيقة" : "Intitulé"}</span><input name="title" maxLength={120} className={medicalInputClass} placeholder={isAr ? "مثال: شهادة أهلية موسم 2026" : "Ex. certificat d’aptitude 2026"} /></label>
          <div className="grid grid-cols-2 gap-3"><label className="flex min-w-0 flex-col gap-2 text-sm"><span className="block leading-5 font-semibold">{isAr ? "تاريخ الإصدار" : "Date d’émission"}</span><input type="date" name="issuedAt" className={medicalInputClass} /></label><label className="flex min-w-0 flex-col gap-2 text-sm"><span className="block leading-5 font-semibold">{isAr ? "تاريخ الانتهاء" : "Date d’expiration"}</span><input type="date" name="expiresAt" className={medicalInputClass} /></label></div>
          <label className="flex min-w-0 flex-col gap-2 text-sm"><span className="block leading-5 font-semibold">{isAr ? "الجهة المصدرة (اختياري)" : "Émetteur (facultatif)"}</span><input name="provider" maxLength={120} className={medicalInputClass} /></label>
          <label className="flex min-w-0 flex-col gap-2 text-sm"><span className="block leading-5 font-semibold">{isAr ? "الحالة الطبية (للأهلية فقط)" : "Aptitude (pour le certificat médical uniquement)"}</span><FormSelect name="status" locale={locale} ariaLabel={isAr ? "الحالة الطبية" : "Statut médical"} options={["PENDING", "FIT", "TEMPORARILY_UNFIT", "UNFIT"].map((status) => ({ value: status, label: statusName[status] || status }))} /></label>
          <label className="flex min-w-0 flex-col gap-2 text-sm"><span className="block leading-5 font-semibold">{isAr ? "الملف (PDF أو صورة)" : "Fichier (PDF ou image)"}</span><input type="file" name="file" required accept=".pdf,.png,.jpg,.jpeg,.webp" className="block min-h-11 w-full rounded-xl border border-border bg-background p-2 text-sm text-foreground shadow-2xs outline-none transition-colors file:me-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:font-bold file:text-primary-foreground focus:border-club-primary focus:ring-2 focus:ring-club-primary/15" /></label>
          <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"><Save className="h-4 w-4" />{isAr ? "حفظ" : "Enregistrer"}</button>
        </form> : <aside className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">{isAr ? "لإضافة وثيقة، يلزم منح صلاحية «إدارة الملفات الطبية» للمستخدم من إعدادات الأدوار." : "L’ajout nécessite la permission « Gérer les dossiers médicaux » dans les rôles."}</aside>}
      </section>
    </main>
  );
}
