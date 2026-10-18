import "server-only";

import { hasPermission, type SessionUser } from "@/lib/permissions";

// ============================================================================
// PHASE 9B — SMART COMMAND REGISTRY
// ----------------------------------------------------------------------------
// Defines centralized navigation commands and operational actions.
// Every entry is strictly gated by RBAC permissions.
// ============================================================================

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  category: "navigation" | "action";
  badge?: string;
  icon?: string;
  requiredPermission?: string;
}

interface RawCommandDefinition {
  id: string;
  href: string;
  category: "navigation" | "action";
  requiredPermission?: string;
  titleAr: string;
  titleFr: string;
  subtitleAr?: string;
  subtitleFr?: string;
  badgeAr?: string;
  badgeFr?: string;
}

const RAW_COMMANDS: RawCommandDefinition[] = [
  // --------------------------------------------------------------------------
  // 1. NAVIGATION SHORTCUTS
  // --------------------------------------------------------------------------
  {
    id: "nav-dashboard",
    href: "/dashboard",
    category: "navigation",
    titleAr: "لوحة التحكم",
    titleFr: "Tableau de bord",
    subtitleAr: "الرئيسية والإحصائيات العامة",
    subtitleFr: "Vue d'ensemble et statistiques"
  },
  {
    id: "nav-notifications",
    href: "/dashboard/notifications",
    category: "navigation",
    titleAr: "الإشعارات",
    titleFr: "Notifications",
    subtitleAr: "تنبيهات النظام والرسائل",
    subtitleFr: "Alertes et messages du club"
  },
  {
    id: "nav-teams",
    href: "/dashboard/teams",
    category: "navigation",
    requiredPermission: "teams.view",
    titleAr: "الفئات والفرق",
    titleFr: "Équipes et catégories",
    subtitleAr: "إدارة الفئات السنية والفرق",
    subtitleFr: "Gestion des catégories et équipes"
  },
  {
    id: "nav-players",
    href: "/dashboard/players",
    category: "navigation",
    requiredPermission: "players.view",
    titleAr: "اللاعبون",
    titleFr: "Joueurs",
    subtitleAr: "سجل اللاعبين وبطاقاتهم",
    subtitleFr: "Effectif et fiches joueurs"
  },
  {
    id: "nav-staff",
    href: "/dashboard/staff",
    category: "navigation",
    requiredPermission: "staff.view",
    titleAr: "الطاقم الفني والإداري",
    titleFr: "Staff technique & administratif",
    subtitleAr: "المدربون والمسيرون والأطباء",
    subtitleFr: "Entraîneurs, dirigeants et médecins"
  },
  {
    id: "nav-matches",
    href: "/dashboard/matches",
    category: "navigation",
    requiredPermission: "matches.view",
    titleAr: "المباريات",
    titleFr: "Matchs",
    subtitleAr: "جدول المباريات والنتائج",
    subtitleFr: "Calendrier et résultats"
  },
  {
    id: "nav-competitions",
    href: "/dashboard/competitions",
    category: "navigation",
    requiredPermission: "competitions.view",
    titleAr: "المنافسات والبطولات",
    titleFr: "Compétitions",
    subtitleAr: "البطولات والكؤوس الرسمية",
    subtitleFr: "Championnats et coupes"
  },
  {
    id: "nav-training",
    href: "/dashboard/training",
    category: "navigation",
    requiredPermission: "training.view",
    titleAr: "الحصص التدريبية",
    titleFr: "Entraînements",
    subtitleAr: "برامج التدريب والحضور",
    subtitleFr: "Séances et présences"
  },
  {
    id: "nav-calendar",
    href: "/dashboard/calendar",
    category: "navigation",
    requiredPermission: "matches.view",
    titleAr: "الرزنامة والتقويم",
    titleFr: "Calendrier général",
    subtitleAr: "جدول المواعيد والمباريات",
    subtitleFr: "Agenda et événements"
  },
  {
    id: "nav-contracts",
    href: "/dashboard/contracts",
    category: "navigation",
    requiredPermission: "contracts.view",
    titleAr: "العقود الرياضية",
    titleFr: "Contrats",
    subtitleAr: "عقود اللاعبين والمدربين",
    subtitleFr: "Contrats joueurs et staff"
  },
  {
    id: "nav-documents",
    href: "/dashboard/documents",
    category: "navigation",
    requiredPermission: "documents.view",
    titleAr: "الأرشيف والوثائق",
    titleFr: "Documents & Archives",
    subtitleAr: "الملفات والمستندات الإدارية",
    subtitleFr: "Dossiers et pièces administratives"
  },
  {
    id: "nav-finance-overview",
    href: "/dashboard/finance",
    category: "navigation",
    requiredPermission: "finance.view",
    titleAr: "المالية والخزينة",
    titleFr: "Finances & Trésorerie",
    subtitleAr: "نظرة عامة على مالية النادي",
    subtitleFr: "Vue générale financière"
  },
  {
    id: "nav-expenses",
    href: "/dashboard/finance/expenses",
    category: "navigation",
    requiredPermission: "finance.view",
    titleAr: "المصاريف والنفقات",
    titleFr: "Dépenses",
    subtitleAr: "سجل نفقات النادي",
    subtitleFr: "Journal des dépenses"
  },
  {
    id: "nav-budgets",
    href: "/dashboard/finance/budgets",
    category: "navigation",
    requiredPermission: "finance.view",
    titleAr: "الميزانيات",
    titleFr: "Budgets",
    subtitleAr: "تخصيصات واستهلاك الميزانية",
    subtitleFr: "Allocations et consommations"
  },
  {
    id: "nav-treasury",
    href: "/dashboard/finance/treasury",
    category: "navigation",
    requiredPermission: "finance.view",
    titleAr: "الحسابات المصرفية والخزينة",
    titleFr: "Comptes de trésorerie",
    subtitleAr: "الأرصدة والحركات المالية",
    subtitleFr: "Soldes et mouvements"
  },
  {
    id: "nav-correspondence",
    href: "/dashboard/correspondence",
    category: "navigation",
    requiredPermission: "correspondence.view",
    titleAr: "المراسلات والبريد",
    titleFr: "Correspondances",
    subtitleAr: "البريد الصادر والوارد",
    subtitleFr: "Courriers entrants et sortants"
  },
  {
    id: "nav-meetings",
    href: "/dashboard/meeting-minutes",
    category: "navigation",
    requiredPermission: "meetings.view",
    titleAr: "الاجتماعات والمحاضر",
    titleFr: "Réunions et comptes-rendus",
    subtitleAr: "سجل جلسات المكتب المسير",
    subtitleFr: "Réunions du bureau et décisions"
  },
  {
    id: "nav-reports",
    href: "/dashboard/reports",
    category: "navigation",
    requiredPermission: "reports.view",
    titleAr: "التقارير والإحصائيات",
    titleFr: "Rapports & Statistiques",
    subtitleAr: "تقارير الأداء والمؤشرات",
    subtitleFr: "Tableaux de bord d'activité"
  },
  {
    id: "nav-users",
    href: "/dashboard/users",
    category: "navigation",
    requiredPermission: "users.view",
    titleAr: "إدارة المستخدمين",
    titleFr: "Utilisateurs",
    subtitleAr: "حسابات النظام وتعيينات الفرق",
    subtitleFr: "Comptes et affectations"
  },
  {
    id: "nav-roles",
    href: "/dashboard/roles",
    category: "navigation",
    requiredPermission: "roles.manage",
    titleAr: "الأدوار والصلاحيات",
    titleFr: "Rôles & Permissions",
    subtitleAr: "مصفوفة الأدوار والصلاحيات",
    subtitleFr: "Matrice des droits d'accès"
  },
  {
    id: "nav-audit-logs",
    href: "/dashboard/audit-logs",
    category: "navigation",
    requiredPermission: "audit.view",
    titleAr: "سجل العمليات والتدقيق",
    titleFr: "Journal d'audit",
    subtitleAr: "تتبع كل الحركات الإدارية والمالية",
    subtitleFr: "Traçabilité des opérations"
  },
  {
    id: "nav-jobs",
    href: "/dashboard/jobs",
    category: "navigation",
    requiredPermission: "settings.manage",
    titleAr: "المهام الخلفية",
    titleFr: "Tâches d'arrière-plan",
    subtitleAr: "حالة الطوابير والمهام المجدولة",
    subtitleFr: "Files d'attente et jobs cron"
  },
  {
    id: "nav-settings",
    href: "/dashboard/settings",
    category: "navigation",
    requiredPermission: "settings.manage",
    titleAr: "إعدادات النادي",
    titleFr: "Paramètres du club",
    subtitleAr: "الهوية، الشعار، والخيارات العامة",
    subtitleFr: "Identité, logo et options"
  },

  // --------------------------------------------------------------------------
  // 2. QUICK ACTIONS (Direct Authorized Creation/Generation Paths)
  // --------------------------------------------------------------------------
  {
    id: "act-new-player",
    href: "/dashboard/players/new",
    category: "action",
    requiredPermission: "players.create",
    titleAr: "إضافة لاعب جديد",
    titleFr: "Ajouter un nouveau joueur",
    subtitleAr: "تسجيل لاعب في صفوف الفريق",
    subtitleFr: "Créer une fiche joueur"
  },
  {
    id: "act-new-staff",
    href: "/dashboard/staff/new",
    category: "action",
    requiredPermission: "staff.create",
    titleAr: "إضافة عضو طاقم",
    titleFr: "Ajouter un membre du staff",
    subtitleAr: "تسجيل إداري أو مدرب أو طبيب",
    subtitleFr: "Créer une fiche encadrant"
  },
  {
    id: "act-new-match",
    href: "/dashboard/matches/new",
    category: "action",
    requiredPermission: "matches.create",
    titleAr: "برمجة مباراة جديدة",
    titleFr: "Programmer un nouveau match",
    subtitleAr: "إدراج لقاء في الرزنامة",
    subtitleFr: "Créer une rencontre officielle"
  },
  {
    id: "act-new-training",
    href: "/dashboard/training/new",
    category: "action",
    requiredPermission: "training.manage",
    titleAr: "برمجة حصة تدريبية",
    titleFr: "Planifier un entraînement",
    subtitleAr: "تحديد موعد ومكان الحصة",
    subtitleFr: "Créer une séance d'entraînement"
  },
  {
    id: "act-new-contract",
    href: "/dashboard/contracts/new",
    category: "action",
    requiredPermission: "contracts.manage",
    titleAr: "تحرير عقد جديد",
    titleFr: "Rédiger un nouveau contrat",
    subtitleAr: "إبرام عقد لاعب أو طاقم",
    subtitleFr: "Nouveau contrat joueur ou staff"
  },
  {
    id: "act-new-expense",
    href: "/dashboard/finance/expenses/new",
    category: "action",
    requiredPermission: "finance.manage",
    titleAr: "تسجيل نفقة جديدة",
    titleFr: "Enregistrer une dépense",
    subtitleAr: "إدراج نفقة ومستند الصرف",
    subtitleFr: "Créer une pièce de dépense"
  },
  {
    id: "act-new-treasury-account",
    href: "/dashboard/finance/treasury/new",
    category: "action",
    requiredPermission: "finance.manage",
    titleAr: "فتح حساب خزينة جديد",
    titleFr: "Créer un compte de trésorerie",
    subtitleAr: "إضافة حساب بنكي أو صندوق نقدي",
    subtitleFr: "Nouveau compte ou caisse"
  },
  {
    id: "act-upload-document",
    href: "/dashboard/documents/new",
    category: "action",
    requiredPermission: "documents.upload",
    titleAr: "إيداع وثيقة في الأرشيف",
    titleFr: "Déposer un document",
    subtitleAr: "رفع وثيقة رسمية ومصنفة",
    subtitleFr: "Téléverser une pièce classée"
  },
  {
    id: "act-new-correspondence",
    href: "/dashboard/correspondence/new",
    category: "action",
    requiredPermission: "correspondence.manage",
    titleAr: "تسجيل مراسلة رسمية",
    titleFr: "Enregistrer un courrier",
    subtitleAr: "تقييد بريد صادر أو وارد",
    subtitleFr: "Nouveau courrier entrant/sortant"
  },
  {
    id: "act-new-meeting",
    href: "/dashboard/meeting-minutes/schedule",
    category: "action",
    requiredPermission: "meetings.manage",
    titleAr: "إنشاء اجتماع جديد",
    titleFr: "Créer une réunion",
    subtitleAr: "جدولة اجتماع وإرسال إشعار للمشاركين",
    subtitleFr: "Planifier une réunion et notifier les participants"
  },
  {
    id: "act-new-news",
    href: "/dashboard/news/new",
    category: "action",
    requiredPermission: "news.create",
    titleAr: "نشر خبر صحفي",
    titleFr: "Publier un article",
    subtitleAr: "إضافة مقال في الموقع الرسمي",
    subtitleFr: "Créer un article d'actualité"
  },
  {
    id: "act-new-announcement",
    href: "/dashboard/announcements/new",
    category: "action",
    requiredPermission: "announcements.create",
    titleAr: "نشر إعلان رسمي",
    titleFr: "Publier un communiqué",
    subtitleAr: "إصدار بيان أو إعلان للجمهور",
    subtitleFr: "Créer un communiqué officiel"
  },
  {
    id: "act-new-user",
    href: "/dashboard/users/new",
    category: "action",
    requiredPermission: "users.manage",
    titleAr: "إنشاء حساب مستخدم",
    titleFr: "Créer un compte utilisateur",
    subtitleAr: "إضافة حساب وتحديد دوره",
    subtitleFr: "Création d'un nouvel utilisateur"
  }
];

/**
 * Returns authorized navigation links and action triggers for the current user.
 */
export function getAuthorizedCommands(
  user: SessionUser,
  locale: string = "ar"
): { navigation: CommandItem[]; actions: CommandItem[] } {
  const isArabic = locale === "ar";

  const authorized = RAW_COMMANDS.filter((cmd) => {
    if (!cmd.requiredPermission) return true;
    return hasPermission(user, cmd.requiredPermission);
  }).map((cmd): CommandItem => ({
    id: cmd.id,
    title: isArabic ? cmd.titleAr : cmd.titleFr,
    subtitle: isArabic ? cmd.subtitleAr : cmd.subtitleFr,
    href: `/${locale}${cmd.href}`,
    category: cmd.category,
    badge: isArabic ? cmd.badgeAr : cmd.badgeFr,
    requiredPermission: cmd.requiredPermission
  }));

  return {
    navigation: authorized.filter((c) => c.category === "navigation"),
    actions: authorized.filter((c) => c.category === "action")
  };
}
