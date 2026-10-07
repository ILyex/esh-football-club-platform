import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePagePermission, hasPermission } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { SettingsNavTabs } from "@/components/settings/settings-nav-tabs";
import { SecurityAnomalyGuard } from "@/components/security/security-anomaly-guard";
import { MasterFilterSelect } from "@/components/shared/master-filter-select";
import { detectSecurityAnomalies } from "@/lib/security/anomaly-detector";
import { ChevronRight, ChevronLeft, Search, Filter } from "lucide-react";

const ENTITY_TYPE_LABELS: Record<string, { ar: string; fr: string }> = {
  Album: { ar: "ألبوم", fr: "Album" },
  Announcement: { ar: "إعلان", fr: "Annonce" },
  BackgroundJob: { ar: "مهمة خلفية", fr: "Tâche en arrière-plan" },
  Budget: { ar: "ميزانية", fr: "Budget" },
  CalendarEvent: { ar: "حدث تقويمي", fr: "Événement du calendrier" },
  ClubSettings: { ar: "إعدادات النادي", fr: "Paramètres du club" },
  Competition: { ar: "منافسة", fr: "Compétition" },
  Contract: { ar: "عقد", fr: "Contrat" },
  Correspondence: { ar: "مراسلة", fr: "Correspondance" },
  Document: { ar: "وثيقة", fr: "Document" },
  DocumentTemplate: { ar: "قالب وثيقة", fr: "Modèle de document" },
  DocumentTemplateVersion: { ar: "إصدار قالب وثيقة", fr: "Version de modèle de document" },
  Expense: { ar: "مصروف", fr: "Dépense" },
  GeneratedDocument: { ar: "وثيقة منشأة", fr: "Document généré" },
  GmailAttachment: { ar: "مرفق بريد إلكتروني", fr: "Pièce jointe Gmail" },
  GmailConnection: { ar: "اتصال Gmail", fr: "Connexion Gmail" },
  GmailMessage: { ar: "رسالة بريد إلكتروني", fr: "Message Gmail" },
  GmailThread: { ar: "محادثة بريد إلكتروني", fr: "Conversation Gmail" },
  Integration: { ar: "تكامل خارجي", fr: "Intégration" },
  InventoryItem: { ar: "عنصر مخزون", fr: "Article d’inventaire" },
  Match: { ar: "مباراة", fr: "Match" },
  MatchEvent: { ar: "حدث في المباراة", fr: "Événement du match" },
  MatchLineup: { ar: "تشكيلة المباراة", fr: "Composition du match" },
  Media: { ar: "وسيط", fr: "Média" },
  MeetingMinute: { ar: "محضر اجتماع", fr: "Procès-verbal de réunion" },
  News: { ar: "خبر", fr: "Actualité" },
  Permission: { ar: "صلاحية", fr: "Permission" },
  Player: { ar: "لاعب", fr: "Joueur" },
  Role: { ar: "دور وظيفي", fr: "Rôle" },
  Season: { ar: "موسم رياضي", fr: "Saison" },
  Staff: { ar: "عضو طاقم", fr: "Membre du personnel" },
  StaffTeam: { ar: "ارتباط الطاقم بالفريق", fr: "Affectation du personnel à l’équipe" },
  Team: { ar: "فريق", fr: "Équipe" },
  TestResult: { ar: "نتيجة اختبار لاعب", fr: "Résultat de test joueur" },
  TestSession: { ar: "جلسة اختبارات اللاعبين", fr: "Session de tests des joueurs" },
  TrainingAttendance: { ar: "حضور تدريب", fr: "Présence à l’entraînement" },
  TrainingSession: { ar: "حصة تدريبية", fr: "Séance d’entraînement" },
  TreasuryAccount: { ar: "حساب الخزينة", fr: "Compte de trésorerie" },
  TreasuryTransaction: { ar: "معاملة خزينة", fr: "Transaction de trésorerie" },
  User: { ar: "مستخدم", fr: "Utilisateur" },
  UserTeam: { ar: "صلاحية المستخدم على الفريق", fr: "Accès utilisateur à l’équipe" },
};

const ACTION_DOMAIN_LABELS: Record<string, { ar: string; fr: string }> = {
  album: { ar: "الألبوم", fr: "l’album" }, announcement: { ar: "الإعلان", fr: "l’annonce" },
  auth: { ar: "تسجيل الدخول", fr: "authentification" }, authorization: { ar: "الصلاحيات", fr: "autorisations" },
  background: { ar: "المهمة الخلفية", fr: "la tâche en arrière-plan" }, budget: { ar: "الميزانية", fr: "le budget" },
  calendarEvent: { ar: "الحدث التقويمي", fr: "l’événement du calendrier" }, competition: { ar: "المنافسة", fr: "la compétition" },
  contract: { ar: "العقد", fr: "le contrat" }, correspondence: { ar: "المراسلة", fr: "la correspondance" },
  document: { ar: "الوثيقة", fr: "le document" }, expense: { ar: "المصروف", fr: "la dépense" },
  finance: { ar: "العملية المالية", fr: "l’opération financière" }, generatedDocument: { ar: "الوثيقة المنشأة", fr: "le document généré" },
  inventory: { ar: "المخزون", fr: "l’inventaire" }, job: { ar: "المهمة الخلفية", fr: "la tâche en arrière-plan" },
  match: { ar: "المباراة", fr: "le match" }, media: { ar: "الوسائط", fr: "le média" }, meeting: { ar: "محضر الاجتماع", fr: "le procès-verbal" },
  news: { ar: "الخبر", fr: "l’actualité" }, player: { ar: "اللاعب", fr: "le joueur" }, role: { ar: "الدور الوظيفي", fr: "le rôle" },
  season: { ar: "الموسم الرياضي", fr: "la saison" }, security: { ar: "الأمان", fr: "la sécurité" }, settings: { ar: "الإعدادات", fr: "les paramètres" },
  staff: { ar: "عضو الطاقم", fr: "le membre du personnel" }, team: { ar: "الفريق", fr: "l’équipe" }, template: { ar: "القالب", fr: "le modèle" },
  training: { ar: "التدريب", fr: "l’entraînement" }, treasury: { ar: "الخزينة", fr: "la trésorerie" }, treasuryAccount: { ar: "حساب الخزينة", fr: "le compte de trésorerie" },
  user: { ar: "المستخدم", fr: "l’utilisateur" },
};

const ACTION_OPERATION_LABELS: Record<string, { ar: string; fr: string }> = {
  create: { ar: "إنشاء", fr: "Création" }, update: { ar: "تحديث", fr: "Mise à jour" }, delete: { ar: "حذف", fr: "Suppression" },
  archive: { ar: "أرشفة", fr: "Archivage" }, upload: { ar: "رفع", fr: "Téléversement" }, download: { ar: "تنزيل", fr: "Téléchargement" },
  attach: { ar: "إرفاق", fr: "Ajout d’une pièce jointe" }, detach: { ar: "إزالة مرفق", fr: "Retrait d’une pièce jointe" },
  "setCover": { ar: "تعيين صورة الغلاف", fr: "Définition de la couverture" }, "permissions_update": { ar: "تحديث الصلاحيات", fr: "Mise à jour des permissions" },
  "team_assignment.add": { ar: "إسناد إلى فريق", fr: "Affectation à une équipe" }, "team_assignment.remove": { ar: "إزالة من الفريق", fr: "Retrait de l’équipe" },
  "event.create": { ar: "إضافة حدث للمباراة", fr: "Ajout d’un événement au match" }, "event.delete": { ar: "حذف حدث من المباراة", fr: "Suppression d’un événement du match" },
  "lineup.upsert": { ar: "تحديث تشكيلة المباراة", fr: "Mise à jour de la composition du match" }, "lineup.remove": { ar: "إزالة لاعب من التشكيلة", fr: "Retrait d’un joueur de la composition" },
  "drug_test_positive_detected": { ar: "رصد نتيجة فحص مخدرات إيجابية", fr: "Détection d’un résultat positif au dépistage" },
  "login_success": { ar: "تسجيل دخول ناجح", fr: "Connexion réussie" }, "login_failed": { ar: "محاولة تسجيل دخول فاشلة", fr: "Échec de connexion" },
  "denied": { ar: "رفض الوصول", fr: "Accès refusé" }, "session.terminated": { ar: "إنهاء الجلسة", fr: "Fin de session" },
  "password_reset": { ar: "إعادة تعيين كلمة المرور", fr: "Réinitialisation du mot de passe" },
  "download_denied": { ar: "رفض تنزيل الوثيقة", fr: "Téléchargement refusé" }, "conversion_failed": { ar: "فشل تحويل الوثيقة", fr: "Échec de conversion du document" },
  "updateBracket": { ar: "تحديث جدول البطولة", fr: "Mise à jour du tableau" }, "updateLogo": { ar: "تحديث الشعار", fr: "Mise à jour du logo" },
  "updateStandings": { ar: "تحديث الترتيب", fr: "Mise à jour du classement" }, "update.programmer": { ar: "تحديث بواسطة النظام", fr: "Mise à jour par le système" },
  "delete.programmer": { ar: "حذف بواسطة النظام", fr: "Suppression par le système" }, "document.upload": { ar: "رفع وثيقة مالية", fr: "Téléversement d’un document financier" },
  "photo.delete": { ar: "حذف الصورة", fr: "Suppression de la photo" }, "insurance.upload": { ar: "رفع وثيقة التأمين", fr: "Téléversement de l’assurance" },
  "insurance.delete": { ar: "حذف وثيقة التأمين", fr: "Suppression de l’assurance" }, "referee_report_ai_analyzed": { ar: "تحليل تقرير الحكم بالذكاء الاصطناعي", fr: "Analyse du rapport arbitral par IA" },
  "attendance.bulk_save": { ar: "حفظ جماعي للحضور", fr: "Enregistrement groupé des présences" }, "attendance.set": { ar: "تحديث الحضور", fr: "Mise à jour des présences" },
  "scanned_sheet.upload": { ar: "رفع كشف الحضور الممسوح ضوئيًا", fr: "Téléversement de la feuille numérisée" }, "scanned_sheet.delete": { ar: "حذف كشف الحضور الممسوح ضوئيًا", fr: "Suppression de la feuille numérisée" },
};

const ACTION_TOKEN_LABELS: Record<string, { ar: string; fr: string }> = {
  update: { ar: "تحديث", fr: "Mise à jour" }, delete: { ar: "حذف", fr: "Suppression" }, create: { ar: "إنشاء", fr: "Création" },
  complete: { ar: "إكمال", fr: "Clôture" }, correct: { ar: "تصحيح", fr: "Correction" }, test: { ar: "اختبار", fr: "test" }, result: { ar: "نتيجة", fr: "résultat" },
  completed: { ar: "إكمال", fr: "Terminé" },
  blocked: { ar: "حظر", fr: "Bloqué" }, required: { ar: "مطلوب", fr: "Requis" }, conflict: { ar: "تعارض", fr: "Conflit" }, detected: { ar: "رصد", fr: "Détecté" },
  faf: { ar: "فاف", fr: "FAF" }, gmail: { ar: "Gmail", fr: "Gmail" }, sync: { ar: "مزامنة", fr: "Synchronisation" },
  attachment: { ar: "مرفق", fr: "pièce jointe" }, accessed: { ar: "تم الوصول إليه", fr: "consulté" }, revoked: { ar: "إلغاء التفويض", fr: "Autorisation révoquée" },
  connected: { ar: "اتصال", fr: "Connexion" }, disconnected: { ar: "قطع الاتصال", fr: "Déconnexion" }, message: { ar: "رسالة", fr: "message" },
  replied: { ar: "رد", fr: "Réponse" }, sent: { ar: "إرسال", fr: "Envoi" }, trashed: { ar: "نقل إلى المهملات", fr: "Mise à la corbeille" },
  read: { ar: "قراءة", fr: "Lecture" }, state: { ar: "حالة", fr: "état" }, changed: { ar: "تغيير", fr: "modifié" },
  permanently: { ar: "نهائيًا", fr: "définitivement" }, failed: { ar: "فشل", fr: "Échec" }, manually: { ar: "يدويًا", fr: "manuellement" },
  cancelled: { ar: "إلغاء", fr: "Annulation" }, retried: { ar: "إعادة المحاولة", fr: "Nouvelle tentative" }, programmer: { ar: "بواسطة النظام", fr: "par le système" },
  positive: { ar: "إيجابي", fr: "positif" },
  auth: { ar: "مصادقة", fr: "Authentification" }, session: { ar: "جلسة", fr: "Session" },
  match: { ar: "مباراة", fr: "Match" }, record: { ar: "سجل", fr: "Enregistrement" }, created: { ar: "إنشاء", fr: "Créé" }, updated: { ar: "تحديث", fr: "Mis à jour" },
};

function getEntityTypeLabel(entityType: string, locale: string) {
  const labels = ENTITY_TYPE_LABELS[entityType];
  return labels ? labels[locale === "ar" ? "ar" : "fr"] : entityType;
}

function getAuditActionLabel(action: string, locale: string) {
  const isAr = locale === "ar";
  const exact = ACTION_OPERATION_LABELS[action];
  if (exact) return exact[isAr ? "ar" : "fr"];

  if (action.includes(".")) {
    const [domainKey, ...operationParts] = action.split(".");
    const domain = ACTION_DOMAIN_LABELS[domainKey!];
    const operation = operationParts.join(".");
    const operationLabel = ACTION_OPERATION_LABELS[operation];
    if (domain && operationLabel) {
      return isAr ? `${operationLabel.ar} ${domain.ar}` : `${operationLabel.fr} — ${domain.fr}`;
    }
    if (domain) {
      const parts = operation.split(/[._]/).filter(Boolean);
      const translated = parts.map((part) => ACTION_TOKEN_LABELS[part]?.[isAr ? "ar" : "fr"]);
      if (translated.every(Boolean)) {
        const phrase = translated.join(" ");
        return isAr ? `${phrase} ${domain.ar}` : `${phrase} — ${domain.fr}`;
      }
    }
  }

  const tokens = action.replace(/([a-z])([A-Z])/g, "$1_$2").split(/[._]/).filter(Boolean);
  const translated = tokens.map((token) => ACTION_TOKEN_LABELS[token.toLowerCase()]?.[isAr ? "ar" : "fr"]);
  return translated.every(Boolean) ? translated.join(" ") : action;
}

export default async function AuditLogsPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ entityType?: string; action?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const currentUser = await requirePagePermission("audit.view", locale);
  const canManageUsers = hasPermission(currentUser, "users.manage");
  const t = await getTranslations("auditLogs");
  const tCommon = await getTranslations("common");
  const isAr = locale === "ar";

  const pageSize = 20; // Exact requirement: 20 per page
  const parsedPage = Number.parseInt(sp.page ?? "1", 10);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 100_000) : 1;
  const where = {
    ...(sp.entityType ? { entityType: sp.entityType } : {}),
    ...(sp.action ? { action: { contains: sp.action.slice(0, 100), mode: "insensitive" as const } } : {})
  };

  const [logs, total, entityTypes, anomalyReport] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    db.auditLog.count({ where }),
    db.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
    detectSecurityAnomalies()
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Build pagination links preserving query parameters
  const createPageUrl = (targetPage: number) => {
    const q = new URLSearchParams();
    if (sp.entityType) q.set("entityType", sp.entityType);
    if (sp.action) q.set("action", sp.action);
    q.set("page", String(targetPage));
    return `/${locale}/dashboard/audit-logs?${q.toString()}`;
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-4">
      <SettingsNavTabs locale={locale} />

      <SecurityAnomalyGuard report={anomalyReport} locale={locale} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{t("title")}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isAr
              ? "متابعة وتدقيق العمليات والتغييرات الإدارية المنفذة في منصة النادي"
              : "Historique et audit des opérations administratives de la plateforme"}
          </p>
        </div>
        <div className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-border bg-card shadow-2xs">
          <span>{isAr ? "إجمالي العمليات الموثقة:" : "Total opérations :"} </span>
          <span className="font-mono text-club-primary font-bold">{total}</span>
        </div>
      </div>

      <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
        {isAr
          ? "سجل التطبيق يوثق الأحداث التي تمر عبر نقاط التدقيق المضافة في المنصة؛ لا يضمن تسجيل كل حدث أو منع تعديل السجل من صلاحيات قاعدة البيانات. للإنتاج، فعّل صلاحيات قاعدة بيانات للقراءة والإضافة فقط على سجل التدقيق، وصدّر نسخة مستقلة محمية."
          : "Le journal trace les événements couverts par l'application ; il ne garantit ni l'exhaustivité ni l'inaltérabilité face aux privilèges de la base. En production, limitez le compte applicatif à la lecture et l'insertion, et exportez une copie protégée."}
      </p>

      {/* Filter Bar */}
      <form className="dashboard-filter-toolbar mb-4">
        <MasterFilterSelect
          name="entityType"
          locale={isAr ? "ar" : "fr"}
          label={`${t("fields.entityType")}:`}
          value={sp.entityType ?? ""}
          options={[
            { id: "", label: isAr ? "كافة أنواع السجلات" : "Tous les types" },
            ...entityTypes.map((e) => ({ id: e.entityType, label: getEntityTypeLabel(e.entityType, locale) }))
          ]}
          headerTitle={isAr ? "تصفية حسب نوع السجل" : "Filtrer par type de journal"}
        />

        <div className="relative min-w-[200px]">
          <input
            name="action"
            defaultValue={sp.action}
            placeholder={isAr ? "بحث في العملية..." : "Rechercher action..."}
            className="w-full rounded-xl border border-border/80 bg-card px-3 py-1.5 text-xs font-medium focus:border-club-primary focus:ring-1 focus:ring-club-primary shadow-2xs"
          />
        </div>

        <Button type="submit" variant="outline" size="sm" className="h-8 rounded-xl gap-1.5 text-xs">
          <Filter className="h-4 w-4 shrink-0" />
          <span>{tCommon("filter")}</span>
        </Button>
      </form>

      {/* Audit Log Table */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-border bg-muted/40 text-start text-xs font-semibold text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-start">{t("fields.timestamp")}</th>
              <th className="px-4 py-3 text-start">{t("fields.actor")}</th>
              <th className="px-4 py-3 text-start">{t("fields.action")}</th>
              <th className="px-4 py-3 text-start">{t("fields.entityType")}</th>
              <th className="px-4 py-3 text-start">{t("fields.entityId")}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap font-mono">
                  {new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-FR", {
                    dateStyle: "short",
                    timeStyle: "medium"
                  }).format(log.createdAt)}
                </td>
                <td className="px-4 py-3">
                  {log.userId && canManageUsers ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Link
                        href={`/${locale}/dashboard/users/${log.userId}`}
                        className="font-semibold hover:underline text-foreground hover:text-club-primary text-xs"
                      >
                        {log.user?.name ?? log.userId}
                      </Link>
                      {log.user?.email && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          ({log.user.email})
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs font-medium text-foreground">{log.user?.name ?? "—"}</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-club-primary font-semibold">
                  {getAuditActionLabel(log.action, locale)}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-block px-2 py-0.5 rounded-md bg-muted text-[11px] font-medium text-foreground">
                    {getEntityTypeLabel(log.entityType, locale)}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {log.entityId ?? "—"}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                  {tCommon("noResults")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Institutional Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground pt-2">
        <p>
          {isAr
            ? `عرض ${logs.length} من أصل ${total} عملية (الصفحة ${page} من ${totalPages})`
            : `Affichage de ${logs.length} sur ${total} opérations (Page ${page} sur ${totalPages})`}
        </p>

        <div className="flex items-center gap-1.5">
          {page > 1 ? (
            <Link
              href={createPageUrl(page - 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:border-club-primary hover:text-club-primary transition-all shadow-2xs"
            >
              {isAr ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
              <span>{isAr ? "السابق" : "Précédent"}</span>
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-lg border border-border/50 bg-muted/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground/60 cursor-not-allowed">
              {isAr ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
              <span>{isAr ? "السابق" : "Précédent"}</span>
            </span>
          )}

          <div className="px-3 py-1.5 rounded-lg border border-border bg-muted/30 font-mono font-bold text-foreground">
            {page} / {totalPages}
          </div>

          {page < totalPages ? (
            <Link
              href={createPageUrl(page + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:border-club-primary hover:text-club-primary transition-all shadow-2xs"
            >
              <span>{isAr ? "التالي" : "Suivant"}</span>
              {isAr ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-lg border border-border/50 bg-muted/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground/60 cursor-not-allowed">
              <span>{isAr ? "التالي" : "Suivant"}</span>
              {isAr ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
