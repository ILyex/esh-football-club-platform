export interface PermissionMeta {
  key: string;
  category: "sporting" | "finance" | "governance" | "media" | "security";
  labelAr: string;
  labelFr: string;
  descAr?: string;
  descFr?: string;
}

export const PERMISSION_CATEGORIES = {
  sporting: {
    id: "sporting",
    titleAr: "القطاع الرياضي، الميداني والمخزون",
    titleFr: "Secteur Sportif, Terrain et Matériel",
    color: "emerald",
    icon: "Trophy"
  },
  finance: {
    id: "finance",
    titleAr: "المالية والخزينة المركزية",
    titleFr: "Finances et Trésorerie Centrale",
    color: "amber",
    icon: "Coins"
  },
  governance: {
    id: "governance",
    titleAr: "الإدارة، الوثائق والتعاقدات",
    titleFr: "Administration, Documents et Contrats",
    color: "blue",
    icon: "FileText"
  },
  media: {
    id: "media",
    titleAr: "الإعلام، الموقع والمراسلات",
    titleFr: "Média, Site Officiel et Messagerie",
    color: "purple",
    icon: "Globe"
  },
  security: {
    id: "security",
    titleAr: "الأمان، المستخدمون والرقابة",
    titleFr: "Sécurité, Utilisateurs et Audit",
    color: "rose",
    icon: "ShieldCheck"
  }
} as const;

export const PERMISSION_METAS: Record<string, PermissionMeta> = {
  // ── 1. القطاع الرياضي والميداني والمخزون ───────────────────────────
  "players.view": {
    key: "players.view",
    category: "sporting",
    labelAr: "معاينة اللاعبين",
    labelFr: "Consulter les joueurs",
    descAr: "الاطلاع على قوائم وبيانات اللاعبين",
    descFr: "Voir la liste et profils des joueurs"
  },
  "players.create": {
    key: "players.create",
    category: "sporting",
    labelAr: "إضافة لاعب جديد",
    labelFr: "Créer un joueur",
    descAr: "تسجيل لاعب جديد في الفئات السنية",
    descFr: "Enregistrer un nouveau joueur"
  },
  "players.update": {
    key: "players.update",
    category: "sporting",
    labelAr: "تعديل بيانات اللاعبين",
    labelFr: "Modifier les joueurs",
    descAr: "تحديث معلومات اللاعب أو حالته الصحية والفنية",
    descFr: "Mettre à jour les informations du joueur"
  },
  "players.archive": {
    key: "players.archive",
    category: "sporting",
    labelAr: "أرشفة ملفات اللاعبين",
    labelFr: "Archiver les joueurs",
    descAr: "نقل ملف اللاعب إلى الأرشيف دون حذفه",
    descFr: "Archiver les dossiers des joueurs"
  },
  "players.delete": {
    key: "players.delete",
    category: "sporting",
    labelAr: "حذف اللاعبين نهائياً",
    labelFr: "Supprimer les joueurs",
    descAr: "إزالة ملف اللاعب نهائياً من قاعدة البيانات",
    descFr: "Supprimer définitivement un joueur"
  },
  "staff.view": {
    key: "staff.view",
    category: "sporting",
    labelAr: "معاينة الطواقم",
    labelFr: "Consulter le staff",
    descAr: "الاطلاع على الطواقم الفنية والإدارية والطبية",
    descFr: "Consulter l'encadrement technique et médical"
  },
  "staff.create": {
    key: "staff.create",
    category: "sporting",
    labelAr: "إضافة عضو طاقم",
    labelFr: "Ajouter un membre du staff",
    descAr: "تسجيل مدرب، مساعد، طبيب أو إداري جديد",
    descFr: "Enregistrer un nouvel encadreur"
  },
  "staff.update": {
    key: "staff.update",
    category: "sporting",
    labelAr: "تعديل بيانات الطواقم",
    labelFr: "Modifier le staff",
    descAr: "تحديث مناصب ومهام وبيانات أعضاء الطاقم",
    descFr: "Modifier les fonctions et coordonnées du staff"
  },
  "staff.delete": {
    key: "staff.delete",
    category: "sporting",
    labelAr: "حذف عضو طاقم",
    labelFr: "Supprimer un membre du staff",
    descAr: "إنهاء ارتباط عضو الطاقم وحذف ملفه",
    descFr: "Supprimer la fiche d'un encadreur"
  },
  "teams.view": {
    key: "teams.view",
    category: "sporting",
    labelAr: "معاينة الفئات السنية",
    labelFr: "Consulter les catégories",
    descAr: "الاطلاع على هيكل الفرق والفئات الشبانية",
    descFr: "Voir les catégories d'âge et effectifs"
  },
  "teams.manage": {
    key: "teams.manage",
    category: "sporting",
    labelAr: "إدارة الفئات السنية",
    labelFr: "Gérer les catégories",
    descAr: "إنشاء الفئات وضبط سنوات الميلاد والتعيينات",
    descFr: "Configurer les catégories et années de naissance"
  },
  "matches.view": {
    key: "matches.view",
    category: "sporting",
    labelAr: "معاينة المباريات",
    labelFr: "Consulter les matchs",
    descAr: "جدول المباريات، التواريخ والنتائج الرسمية",
    descFr: "Calendrier et résultats des rencontres"
  },
  "matches.create": {
    key: "matches.create",
    category: "sporting",
    labelAr: "برمجة مباراة جديدة",
    labelFr: "Programmer un match",
    descAr: "تسجيل موعد وملعب ومنافس المباراة",
    descFr: "Ajouter une nouvelle rencontre au calendrier"
  },
  "matches.update": {
    key: "matches.update",
    category: "sporting",
    labelAr: "إدارة المباراة",
    labelFr: "Gérer un match",
    descAr: "تحديث التوقيت، النتيجة أو تفاصيل المقابلة",
    descFr: "Mettre à jour le score et les détails du match"
  },
  "matches.delete": {
    key: "matches.delete",
    category: "sporting",
    labelAr: "حذف وإلغاء المباراة",
    labelFr: "Supprimer un match",
    descAr: "إلغاء المقابلة وحذفها من البرنامج",
    descFr: "Annuler et supprimer une rencontre"
  },
  "matches.report": {
    key: "matches.report",
    category: "sporting",
    labelAr: "تحرير ورقة المباراة والتشكيلة",
    labelFr: "Feuille de match et événements",
    descAr: "تسجيل التشكيلة الأساسية، الأهداف، الإنذارات وتقرير المقابلة",
    descFr: "Compositions d'équipe, buts, cartons et rapport FAF"
  },
  "competitions.view": {
    key: "competitions.view",
    category: "sporting",
    labelAr: "معاينة المنافسات",
    labelFr: "Consulter les compétitions",
    descAr: "البطولات والكؤوس الرسمية المسجلة",
    descFr: "Championnats et coupes enregistrées"
  },
  "competitions.manage": {
    key: "competitions.manage",
    category: "sporting",
    labelAr: "إدارة المنافسات",
    labelFr: "Gérer les compétitions",
    descAr: "إنشاء وضبط البطولات والمواسم الرياضية",
    descFr: "Créer et paramétrer les compétitions"
  },
  "training.view": {
    key: "training.view",
    category: "sporting",
    labelAr: "معاينة الحصص التدريبية",
    labelFr: "Consulter les entraînements",
    descAr: "جدول التدريبات ومواعيد الحصص الأسبوعية",
    descFr: "Planning des séances d'entraînement"
  },
  "training.manage": {
    key: "training.manage",
    category: "sporting",
    labelAr: "إدارة التدريبات والغيابات",
    labelFr: "Gérer les entraînements et présences",
    descAr: "برمجة الحصص التدريبية، تسجيل الحضور ورصد الغيابات",
    descFr: "Planifier séances, présences et bilans d'entraînement"
  },
  "calendar.view": {
    key: "calendar.view",
    category: "sporting",
    labelAr: "معاينة الروزنامة المركزية",
    labelFr: "Consulter le calendrier",
    descAr: "الاطلاع على أجندة النادي الموحدة (مباريات، تدريبات، أحداث)",
    descFr: "Voir l'agenda centralisé du club"
  },
  "calendar.manage": {
    key: "calendar.manage",
    category: "sporting",
    labelAr: "إدارة الروزنامة والأحداث",
    labelFr: "Gérer les événements du calendrier",
    descAr: "إضافة وتعديل الأحداث، الاجتماعات والمواعيد الرياضية",
    descFr: "Planifier et modifier les événements du calendrier"
  },
  "testing.view": {
    key: "testing.view",
    category: "sporting",
    labelAr: "معاينة الاختبارات البدنية (اليويو)",
    labelFr: "Consulter les tests physiques",
    descAr: "سجلات اختبارات اليويو واللياقة والسرعة للاعبين",
    descFr: "Historique des tests Yo-Yo et métriques physiologiques"
  },
  "testing.manage": {
    key: "testing.manage",
    category: "sporting",
    labelAr: "تسجيل واعتماد جلسات الاختبار",
    labelFr: "Gérer et valider les tests",
    descAr: "إدخال القياسات، مستويات السرعة واعتماد جلسات الاختبار",
    descFr: "Saisie des mesures et validation des sessions de tests"
  },
  "testing.correct": {
    key: "testing.correct",
    category: "sporting",
    labelAr: "تصحيح نتائج الاختبارات المعتمدة",
    labelFr: "Corriger les tests validés",
    descAr: "تعديل تدقيقي لنتائج اختبار معتمد مع تبرير إلزامي",
    descFr: "Correction tracée et auditée d'un test validé"
  },
  "testing.manage_definitions": {
    key: "testing.manage_definitions",
    category: "sporting",
    labelAr: "إدارة بروتوكولات الاختبارات",
    labelFr: "Gérer les protocoles de tests",
    descAr: "ضبط بروتوكولات الفيفا، سرعات اليويو ومعايير التقييم",
    descFr: "Configurer les normes FIFA et barèmes de notation"
  },
  "inventory.manage": {
    key: "inventory.manage",
    category: "sporting",
    labelAr: "إدارة العتاد، المخزون ومحاضر الجرد",
    labelFr: "Gérer le matériel et inventaire",
    descAr: "متابعة الأقمصة، الكرات، التجهيزات الرياضية وطباعة محاضر الجرد الرسمية",
    descFr: "Gestion du stock, dotations d'équipements et PV d'inventaire"
  },

  // ── 2. المالية والخزينة المركزية ───────────────────────────
  "finance.view": {
    key: "finance.view",
    category: "finance",
    labelAr: "الاطلاع على المالية والخزينة",
    labelFr: "Consulter les finances",
    descAr: "معاينة الميزانية السنوية، سجلات العمليات المالية ورصيد الخزينة المتوفر",
    descFr: "Visualiser budget, grand livre et solde de trésorerie"
  },
  "finance.manage": {
    key: "finance.manage",
    category: "finance",
    labelAr: "إعداد مسودات الصرف والميزانية",
    labelFr: "Préparer les opérations financières",
    descAr: "تسجيل مسودات النفقات، إعداد مخصصات الميزانية، وتجهيز الفواتير",
    descFr: "Saisie des brouillons de dépenses et préparation budgétaire"
  },
  "finance.approve": {
    key: "finance.approve",
    category: "finance",
    labelAr: "اعتماد وترحيل الإيداع والسحب والصرف",
    labelFr: "Approuver dépôts, retraits et dépenses",
    descAr: "تسجيل إيداع بنكي رسمي، تسجيل سحب نقد، وترحيل المصاريف القانونية",
    descFr: "Validation définitive, bons officiels et mouvements de fonds"
  },
  "finance.budgets": {
    key: "finance.budgets",
    category: "finance",
    labelAr: "إدارة الميزانية التقديرية للفئات",
    labelFr: "Gérer le budget prévisionnel",
    descAr: "توزيع ميزانيات الفئات السنية، تتبع نسب الاستهلاك، ورصد الفائض والعجز",
    descFr: "Allocation des budgets par catégorie et suivi des dépenses"
  },
  "finance.vouchers": {
    key: "finance.vouchers",
    category: "finance",
    labelAr: "معاينة وطباعة الأوصال والفواتير الرسمية",
    labelFr: "Consulter et imprimer les bons et factures",
    descAr: "استخراج وطباعة وصولات الإيداع والسحب النقدية وفواتير الصرف المعتمدة",
    descFr: "Édition et impression des bons de caisse et factures certifiées"
  },
  "finance.subsidies": {
    key: "finance.subsidies",
    category: "finance",
    labelAr: "تعديل الإعانة والرصيد الافتتاحي (للمبرمج/الإدارة)",
    labelFr: "Modifier la subvention et solde d'ouverture",
    descAr: "تعديل مبالغ الدعم والإعانة والأرصدة الافتتاحية لحسابات الخزينة المركزية",
    descFr: "Ajustement du solde d'ouverture et subventions certifiées"
  },

  // ── 3. الإدارة والوثائق والتعاقدات ───────────────────────────
  "contracts.view": {
    key: "contracts.view",
    category: "governance",
    labelAr: "معاينة العقود",
    labelFr: "Consulter les contrats",
    descAr: "الاطلاع على عقود اللاعبين والمدربين والاتفاقيات",
    descFr: "Consulter les contrats des joueurs et du staff"
  },
  "contracts.manage": {
    key: "contracts.manage",
    category: "governance",
    labelAr: "إدارة العقود والتوثيق",
    labelFr: "Gérer les contrats",
    descAr: "تحرير وتجديد وتوقيع العقود الرسمية وتواريخ الانتهاء",
    descFr: "Rédiger, renouveler et résilier les contrats"
  },
  "correspondence.view": {
    key: "correspondence.view",
    category: "governance",
    labelAr: "معاينة المراسلات والطعون",
    labelFr: "Consulter les correspondances et recours",
    descAr: "سجل الصادر والوارد الرسمي مع الرابطة والاتحاد والبلدية",
    descFr: "Courriers officiels départs et arrivées"
  },
  "correspondence.manage": {
    key: "correspondence.manage",
    category: "governance",
    labelAr: "إدارة المراسلات والطعون",
    labelFr: "Gérer les correspondances et recours",
    descAr: "تسجيل وأرشفة وتوجيه المراسلات الإدارية الصادرة والواردة",
    descFr: "Enregistrer et archiver les courriers officiels"
  },
  "meetings.view": {
    key: "meetings.view",
    category: "governance",
    labelAr: "معاينة محاضر الجلسات",
    labelFr: "Consulter les procès-verbaux",
    descAr: "الاطلاع على محاضر اجتماعات مجلس الإدارة والجمعيات العامة",
    descFr: "Consulter les PV des réunions et assemblées"
  },
  "meetings.manage": {
    key: "meetings.manage",
    category: "governance",
    labelAr: "تحرير وتوقيع محاضر الجلسات",
    labelFr: "Gérer les procès-verbaux",
    descAr: "كتابة محاضر الجلسات، تسجيل جدول الأعمال وتوقيع القرارات",
    descFr: "Rédiger, signer et archiver les PV de direction"
  },
  "documents.view": {
    key: "documents.view",
    category: "governance",
    labelAr: "معاينة الوثائق العامة",
    labelFr: "Consulter les documents publics",
    descAr: "الاطلاع على الوثائق والمستندات غير المقيدة للنادي",
    descFr: "Accéder aux documents non restreints"
  },
  "documents.view.restricted": {
    key: "documents.view.restricted",
    category: "governance",
    labelAr: "معاينة الوثائق السرية والمقيدة",
    labelFr: "Consulter documents confidentiels",
    descAr: "الاطلاع على العقود المالية، محاضر التأسيس والوثائق الحساسة",
    descFr: "Accès exclusif aux pièces administratives confidentielles"
  },
  "documents.create": {
    key: "documents.create",
    category: "governance",
    labelAr: "رفع وثائق ومرفقات جديدة",
    labelFr: "Téléverser des documents",
    descAr: "إضافة ملفات ومستندات جديدة للأرشيف الرقمي",
    descFr: "Ajouter de nouvelles pièces à la GED"
  },
  "documents.update": {
    key: "documents.update",
    category: "governance",
    labelAr: "تعديل بيانات وتصنيف الوثائق",
    labelFr: "Modifier les métadonnées",
    descAr: "تحديث التصنيف، المجلد ودرجة سرية الملف",
    descFr: "Éditer classification et métadonnées des documents"
  },
  "documents.delete": {
    key: "documents.delete",
    category: "governance",
    labelAr: "حذف الوثائق من الأرشيف",
    labelFr: "Supprimer des documents",
    descAr: "حذف المستندات والملفات المرفوعة",
    descFr: "Supprimer des documents archivés"
  },
  "templates.view": {
    key: "templates.view",
    category: "governance",
    labelAr: "معاينة قوالب المستندات الرسمية",
    labelFr: "Consulter les modèles",
    descAr: "الاطلاع على قوالب المحاضر، الاستدعاءات والشهادات",
    descFr: "Visualiser les modèles officiels de documents"
  },
  "templates.manage": {
    key: "templates.manage",
    category: "governance",
    labelAr: "إدارة قوالب المستندات",
    labelFr: "Gérer les modèles",
    descAr: "رفع قوالب جديدة وضبط حقول الاستبدال الآلي",
    descFr: "Créer et configurer les modèles de génération"
  },
  "documents.generate": {
    key: "documents.generate",
    category: "governance",
    labelAr: "توليد الوثائق الرسمية آلياً",
    labelFr: "Générer les documents officiels",
    descAr: "استخراج الأوصال والاستدعاءات والشهادات المعتمدة من القوالب",
    descFr: "Génération automatique d'actes et attestations"
  },

  // ── 4. الإعلام، الموقع والمراسلات ───────────────────────────
  "news.view": {
    key: "news.view",
    category: "media",
    labelAr: "معاينة الأخبار والمقالات",
    labelFr: "Consulter les actualités",
    descAr: "الاطلاع على الأخبار المنشورة والمسودات",
    descFr: "Voir les articles publiés et les brouillons"
  },
  "news.create": {
    key: "news.create",
    category: "media",
    labelAr: "كتابة خبر جديد",
    labelFr: "Créer une actualité",
    descAr: "تحرير مقال أو تغطية إعلامية جديدة",
    descFr: "Rédiger un nouvel article pour le club"
  },
  "news.update": {
    key: "news.update",
    category: "media",
    labelAr: "تعديل الأخبار والمقالات",
    labelFr: "Modifier les actualités",
    descAr: "تحديث نصوص وصور وعناوين المقالات",
    descFr: "Mettre à jour le contenu des articles"
  },
  "news.delete": {
    key: "news.delete",
    category: "media",
    labelAr: "حذف المقالات والأخبار",
    labelFr: "Supprimer des actualités",
    descAr: "إزالة الأخبار غير المرغوبة",
    descFr: "Supprimer définitivement des articles"
  },
  "news.publish": {
    key: "news.publish",
    category: "media",
    labelAr: "نشر وإلغاء نشر الأخبار",
    labelFr: "Publier les actualités",
    descAr: "إتاحة الخبر على الموقع الرسمي للجمهور أو حجبه",
    descFr: "Mettre en ligne sur le site public ou dépublier"
  },
  "announcements.view": {
    key: "announcements.view",
    category: "media",
    labelAr: "معاينة الإعلانات",
    labelFr: "Consulter les annonces",
    descAr: "الاطلاع على الإعلانات الرسمية الداخلية والعامة",
    descFr: "Voir les annonces officielles du club"
  },
  "announcements.manage": {
    key: "announcements.manage",
    category: "media",
    labelAr: "إدارة ونشر الإعلانات",
    labelFr: "Gérer les annonces",
    descAr: "نشر البلاغات والتنبيهات الموجهة للأنصار واللاعبين",
    descFr: "Créer, cibler et diffuser les annonces"
  },
  "gallery.view": {
    key: "gallery.view",
    category: "media",
    labelAr: "معاينة معرض الصور",
    labelFr: "Consulter la galerie",
    descAr: "تصفح ألبومات صور المباريات والتدريبات",
    descFr: "Parcourir la galerie photo du club"
  },
  "gallery.manage": {
    key: "gallery.manage",
    category: "media",
    labelAr: "إدارة ألبومات ومعرض الصور",
    labelFr: "Gérer la galerie",
    descAr: "رفع الصور، إنشاء الألبومات وإدارتها في الموقع",
    descFr: "Créer des albums, téléverser et trier les photos"
  },
  "mail.view": {
    key: "mail.view",
    category: "media",
    labelAr: "الاطلاع على البريد الرسمي للنادي",
    labelFr: "Consulter la messagerie",
    descAr: "قراءة الرسائل الواردة والمحادثات والمرفقات الرسمية",
    descFr: "Lire les emails officiels de la boîte du club"
  },
  "mail.send": {
    key: "mail.send",
    category: "media",
    labelAr: "إرسال رسائل البريد الرسمي",
    labelFr: "Envoyer des emails",
    descAr: "كتابة وإرسال الرسائل والردود باسم بريد النادي",
    descFr: "Composer et expédier des emails officiels"
  },
  "mail.manage": {
    key: "mail.manage",
    category: "media",
    labelAr: "إدارة إعدادات البريد وربط Gmail",
    labelFr: "Gérer les paramètres email",
    descAr: "ربط حساب Google الرسمي، وإدارة المزامنة، وفلترة البريد العشوائي",
    descFr: "Gérer la connexion OAuth Gmail et les filtres"
  },

  // ── 5. الأمان، المستخدمون والرقابة ───────────────────────────
  "users.view": {
    key: "users.view",
    category: "security",
    labelAr: "معاينة المستخدمين",
    labelFr: "Consulter les utilisateurs",
    descAr: "الاطلاع على قائمة حسابات النظام وحالاتها",
    descFr: "Consulter les comptes utilisateurs actifs"
  },
  "users.manage": {
    key: "users.manage",
    category: "security",
    labelAr: "إدارة حسابات المستخدمين والفرق",
    labelFr: "Gérer les utilisateurs",
    descAr: "إنشاء المستخدمين، إعادة تعيين الكلمات السرية، وتعيين نطاق الفرق",
    descFr: "Créer comptes, reset mot de passe et assignations d'équipes"
  },
  "roles.manage": {
    key: "roles.manage",
    category: "security",
    labelAr: "إدارة الأدوار ومصفوفة الصلاحيات",
    labelFr: "Gérer les rôles et permissions",
    descAr: "تعديل الصلاحيات الممنوحة لكل دور وإنشاء أدوار مخصصة",
    descFr: "Configurer la matrice RBAC et créer des rôles"
  },
  "audit.view": {
    key: "audit.view",
    category: "security",
    labelAr: "معاينة سجلات التدقيق والأمان",
    labelFr: "Consulter le journal d'audit",
    descAr: "تتبع كل الحركات الإدارية، درع الأمان وإنهاء الجلسات المشبوهة",
    descFr: "Traçabilité des opérations et révocation des sessions"
  },
  "settings.manage": {
    key: "settings.manage",
    category: "security",
    labelAr: "إدارة إعدادات النادي والمنصة",
    labelFr: "Gérer les paramètres du club",
    descAr: "معلومات النادي الأساسية، الهوية البصرية وخيارات النظام",
    descFr: "Configuration générale et identité visuelle du club"
  },
  "reports.view": {
    key: "reports.view",
    category: "security",
    labelAr: "معاينة التقارير والتحليلات الشاملة",
    labelFr: "Consulter les rapports globaux",
    descAr: "التقارير التحليلية والإحصائية الشاملة لكافة قطاعات النادي",
    descFr: "Rapports d'activité consolidés et statistiques"
  },
  "*": {
    key: "*",
    category: "security",
    labelAr: "صلاحية كاملة على المنصة",
    labelFr: "Accès complet à la plateforme",
    descAr: "صلاحيات هندسية وإدارية كاملة وغير مقيدة على كافة أقسام المنصة",
    descFr: "Contrôle technique et administratif absolu sur toute la plateforme"
  }
};

export function getPermissionMeta(key: string, group?: string): PermissionMeta {
  if (PERMISSION_METAS[key]) {
    return PERMISSION_METAS[key];
  }

  // Fallback for any unexpected dynamic keys
  let category: PermissionMeta["category"] = "security";
  if (
    key.startsWith("player") ||
    key.startsWith("staff") ||
    key.startsWith("team") ||
    key.startsWith("match") ||
    key.startsWith("testing") ||
    key.startsWith("train") ||
    key.startsWith("calendar") ||
    key.startsWith("inventory") ||
    key.startsWith("compet")
  ) {
    category = "sporting";
  } else if (key.startsWith("finance")) {
    category = "finance";
  } else if (
    key.startsWith("contract") ||
    key.startsWith("doc") ||
    key.startsWith("template") ||
    key.startsWith("meeting") ||
    key.startsWith("corr")
  ) {
    category = "governance";
  } else if (
    key.startsWith("news") ||
    key.startsWith("gallery") ||
    key.startsWith("mail") ||
    key.startsWith("announc")
  ) {
    category = "media";
  }

  return {
    key,
    category,
    labelAr: key,
    labelFr: key
  };
}
