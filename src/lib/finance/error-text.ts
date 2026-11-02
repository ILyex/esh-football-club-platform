/**
 * Client-safe mapping from finance integrity error codes to short, localized
 * messages.
 *
 * The finance services throw stable UPPER_SNAKE codes (never localized text).
 * Page-level flows turn them into `?notice=finance.errors.CODE`; the small
 * modal dialogs that call Server Actions directly need a one-line message too,
 * otherwise the user sees the raw code ("POSTED_EXPENSE_DELETE_BLOCKED").
 */
const MESSAGES: Record<string, { ar: string; fr: string }> = {
  FORBIDDEN_PROGRAMMER: {
    ar: "هذه العملية مقيدة على مبرمج النظام المسؤول فقط.",
    fr: "Cette opération est réservée au programmeur système responsable."
  },
  POSTED_EXPENSE_DELETE_BLOCKED: {
    ar: "لا يمكن حذف مصروف مرحّل؛ ألغِه للحفاظ على السجل المالي.",
    fr: "Une dépense comptabilisée ne peut pas être supprimée ; annulez-la pour préserver l'historique."
  },
  EXPENSE_HAS_LEDGER_MOVEMENT: {
    ar: "هذا المصروف مرتبط بحركة خزينة ولا يمكن حذفه.",
    fr: "Cette dépense est liée à un mouvement de trésorerie et ne peut pas être supprimée."
  },
  EXPENSE_SETTLED_AMOUNT_IMMUTABLE: {
    ar: "لا يمكن تغيير مبلغ مصروف سُدد بالفعل؛ اعكس الدفعة ثم أعد التسجيل.",
    fr: "Le montant d'une dépense réglée ne peut pas changer ; annulez le paiement puis ressaisissez."
  },
  REVERSAL_IMMUTABLE: {
    ar: "القيد العكسي سجل تصحيحي لا يمكن تعديله أو حذفه.",
    fr: "Une écriture d'annulation est une correction : ni modifiable ni supprimable."
  },
  MIRROR_ROW_IMMUTABLE: {
    ar: "هذا القيد مرتبط بحركة نقدية تلقائية؛ عدّل العملية الأصلية بدلًا منه.",
    fr: "Cette écriture est liée à une contrepartie de caisse ; modifiez l'opération d'origine."
  },
  MIRROR_MUST_BE_REVERSED_WITH_PARENT: {
    ar: "اعكس العملية الأصلية وسيُعكس طرفها النقدي تلقائيًا.",
    fr: "Annulez l'opération d'origine ; sa contrepartie de caisse suivra automatiquement."
  },
  EXPENSE_LINKED_ROW_IMMUTABLE: {
    ar: "هذه الحركة تسدد مصروفًا؛ استخدم العكس بدل التعديل أو الحذف.",
    fr: "Cette écriture règle une dépense ; utilisez l'annulation."
  },
  INSUFFICIENT_FUNDS: {
    ar: "الرصيد غير كافٍ لإتمام هذه العملية.",
    fr: "Solde insuffisant pour effectuer cette opération."
  },
  CONCURRENT_UPDATE: {
    ar: "تم اكتشاف تعديل متزامن؛ يرجى المحاولة مرة أخرى.",
    fr: "Modification simultanée détectée ; veuillez réessayer."
  }
};

/** Localized message for a finance error code, or null when the code is unknown. */
export function financeErrorMessage(code: unknown, locale: string): string | null {
  if (typeof code !== "string") return null;
  const entry = MESSAGES[code];
  if (!entry) return null;
  return locale === "fr" ? entry.fr : entry.ar;
}

/** Extracts the stable code from a thrown Server Action error (message is the code). */
export function financeErrorCode(error: unknown): string | null {
  if (error instanceof Error && error.message && MESSAGES[error.message]) return error.message;
  return null;
}
