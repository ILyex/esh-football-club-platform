const FIELD_LABELS: Record<string, { ar: string; fr: string }> = {
  competitionId: { ar: "المسابقة", fr: "Compétition" },
  teamId: { ar: "الفريق", fr: "Équipe" },
  opponent: { ar: "اسم الفريق بالعربية", fr: "Nom arabe de l’équipe" },
  opponentNameFr: { ar: "اسم الفريق بالفرنسية", fr: "Nom français de l’équipe" },
  matchDate: { ar: "تاريخ ووقت المباراة", fr: "Date et heure du match" },
  stadium: { ar: "الملعب", fr: "Stade" },
  status: { ar: "حالة المباراة", fr: "Statut du match" },
  homeScore: { ar: "نتيجة الفريق المضيف", fr: "Score de l’équipe à domicile" },
  awayScore: { ar: "نتيجة الفريق الضيف", fr: "Score de l’équipe visiteuse" },
  hasPenaltyShootout: { ar: "إعداد ركلات الترجيح والوقت الإضافي", fr: "Paramètres des tirs au but et des prolongations" },
  refereeName: { ar: "أسماء الحكام", fr: "Noms des arbitres" },
  refereeNameAr: { ar: "أسماء الحكام بالعربية", fr: "Noms des arbitres en arabe" },
  refereeNameFr: { ar: "أسماء الحكام بالفرنسية", fr: "Noms des arbitres en français" },
  lineupEntries: { ar: "تشكيلة المباراة", fr: "Composition du match" }
};

export type MatchFormError = { formError: { field?: string; message: string } };

/** Convert server validation failures into safe, actionable form feedback. */
export function getMatchFormError(error: unknown, locale: string): MatchFormError {
  const message = error instanceof Error ? error.message : "";
  const isArabic = locale === "ar";
  if (message === "shootoutWinnerRequired") {
    return {
      formError: {
        field: "hasPenaltyShootout",
        message: isArabic
          ? "لا يمكن إنهاء المباراة بالتعادل قبل حسم ركلات الترجيح. أكمل الركلات أولاً."
          : "Le match ne peut pas se terminer sur un nul avant la fin des tirs au but. Terminez la séance d’abord."
      }
    };
  }
  if (message === "shootoutAlreadyDecided") {
    return {
      formError: {
        field: "hasPenaltyShootout",
        message: isArabic
          ? "ركلات الترجيح محسومة بالفعل. احذف الركلة الأخيرة إذا أردت تصحيح النتيجة."
          : "La séance de tirs au but est déjà décidée. Supprimez le dernier tir pour corriger le résultat."
      }
    };
  }
  const issues = (error as { issues?: Array<{ path?: Array<string | number> }> } | null)?.issues;
  let field = issues?.[0]?.path?.[0]?.toString();

  if (!field && /competitionTeamMismatch/i.test(message)) field = "competitionId";
  if (!field && /invalidLineupPlayer|invalidLineupEntries/i.test(message)) field = "lineupEntries";
  if (!field && /invalidMatchStatus/i.test(message)) field = "status";

  const label = field ? FIELD_LABELS[field]?.[isArabic ? "ar" : "fr"] : undefined;
  if (label) {
    return {
      formError: {
        field,
        message: isArabic
          ? `تعذر الحفظ: راجع خانة «${label}».`
          : `Enregistrement impossible : vérifiez le champ « ${label} ».`
      }
    };
  }

  return {
    formError: {
      message: isArabic
        ? "تعذر الحفظ بسبب خطأ في بيانات المباراة أو اتصال الخادم. راجع الخانات المطلوبة ثم أعد المحاولة."
        : "Enregistrement impossible : vérifiez les champs obligatoires et la connexion, puis réessayez."
    }
  };
}
