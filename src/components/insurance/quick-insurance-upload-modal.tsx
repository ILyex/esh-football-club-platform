"use client";

import { useState } from "react";
import { UploadCloud, CheckCircle2, AlertCircle, X, Shield, FileText, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { parseDMYToISO } from "@/lib/date-utils";

interface QuickInsuranceUploadModalProps {
  playerId: string;
  playerName: string;
  teamCategory?: string | null;
  locale?: string;
  onSuccess?: () => void;
}

export function QuickInsuranceUploadModal({
  playerId,
  playerName,
  teamCategory,
  locale = "ar"
}: QuickInsuranceUploadModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [policyNumber, setPolicyNumber] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectFindings, setRejectFindings] = useState<Array<{ code: string; params?: Record<string, string | number> }>>([]);
  const [success, setSuccess] = useState(false);

  const isAr = locale === "ar";

  // Finding code → localized message
  const findingMessages: Record<string, (p?: Record<string, string | number>) => string> = {
    OTHER_PLAYER: (p) => isAr
      ? `الوثيقة غير مطابقة لمعلومات اللاعب؛ الاسم الظاهر يخص لاعبًا آخر (${p?.other ?? ""}) وليس ${p?.name ?? "اللاعب المحدد"}.`
      : `Le document ne correspond pas aux informations du joueur : le nom détecté est celui d’un autre joueur (${p?.other ?? ""}), pas ${p?.name ?? "du joueur sélectionné"}.`,
    NAME_MISSING: (p) => isAr
      ? `الوثيقة غير مطابقة لمعلومات اللاعب؛ لم يُعثر على اسم ${p?.name ?? "اللاعب المحدد"} فيها.`
      : `Le document ne correspond pas aux informations du joueur : le nom de ${p?.name ?? "la personne sélectionnée"} n’y apparaît pas.`,
    NAME_UNCERTAIN: (p) => isAr
      ? `تعذّر التحقق من اسم اللاعب (${p?.name ?? ""}) في الوثيقة`
      : `Impossible de vérifier le nom du joueur (${p?.name ?? ""})`,
    WRONG_DOCUMENT_TYPE: () => isAr
      ? `نوع الملف لا يطابق الوثيقة المطلوبة (تأمين رياضي). تحقّق من الوثيقة التي رفعتها واختر وثيقة التأمين الصحيحة.`
      : `Le fichier ne correspond pas au document demandé (assurance sportive). Vérifiez le fichier et sélectionnez l’attestation d’assurance attendue.`,
    AMOUNT_MISMATCH: (p) => isAr
      ? `المبلغ المسجّل (${p?.amount ?? ""} دج) غير موجود في الوثيقة`
      : `Le montant déclaré (${p?.amount ?? ""} DA) absent du document`,
    AMOUNT_NOT_FOUND: () => isAr
      ? `لم يُعثر على أي مبلغ في الوثيقة`
      : `Aucun montant trouvé dans le document`,
    DATE_MISMATCH: (p) => isAr
      ? `السنة الواردة في الوثيقة لا تتطابق مع تاريخ العملية (${p?.year ?? ""})`
      : `L'année du document ne correspond pas à l'opération (${p?.year ?? ""})`,
    UNREADABLE: () => isAr
      ? `تعذّرت قراءة محتوى الوثيقة بوضوح. لم تُحفظ ولم تتغير حالة التأمين؛ ارفع ملفًا سليمًا أو نسخة أوضح.`
      : `Le contenu du document n’a pas pu être lu clairement. Il n’a pas été enregistré et le statut d’assurance n’a pas changé. Envoyez un fichier valide ou une copie plus lisible.`,
  };

  const getVerificationMessage = (verdict: string, findings: Array<{ code: string; params?: Record<string, string | number> }>) => {
    const priority = verdict === "REJECT"
      ? ["OTHER_PLAYER", "WRONG_DOCUMENT_TYPE", "NAME_MISSING", "NAME_UNCERTAIN", "UNREADABLE"]
      : ["UNREADABLE", "WRONG_DOCUMENT_TYPE", "OTHER_PLAYER", "NAME_MISSING", "NAME_UNCERTAIN"];
    const finding = priority.map((code) => findings.find((item) => item.code === code)).find(Boolean);
    const messageForFinding = finding ? findingMessages[finding.code] : undefined;
    if (finding && messageForFinding) return messageForFinding(finding.params);
    return isAr
      ? "تعذّر التحقق من وثيقة التأمين، لذلك لم تُحفظ ولم تتغير حالة اللاعب. راجع سبب التحقق أدناه."
      : "L’assurance n’a pas pu être vérifiée ; elle n’a pas été enregistrée et le statut du joueur n’a pas changé. Consultez le motif ci-dessous.";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError(isAr ? "يرجى اختيار ملف الوثيقة (PDF أو صورة)" : "Veuillez sélectionner un fichier (PDF ou image)");
      return;
    }

    const toTimestamp = (val: string) => {
      const dmy = val.trim().match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
      if (dmy && dmy[1] && dmy[2] && dmy[3]) {
        return new Date(`${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`).getTime();
      }
      return new Date(val).getTime();
    };

    if (startDate && endDate && toTimestamp(endDate) <= toTimestamp(startDate)) {
      setError(isAr ? "تاريخ نهاية التأمين يجب أن يكون بعد تاريخ البداية" : "La date de fin doit être postérieure à la date de début");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setRejectFindings([]);

    try {
      const formData = new FormData();
      formData.append("insuranceFile", file);
      if (startDate) formData.append("startDate", startDate);
      if (endDate) formData.append("endDate", endDate);
      if (policyNumber) formData.append("policyNumber", policyNumber);

      const response = await fetch(`/api/players/${playerId}/insurance`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if ((data.verdict === "REJECT" || data.verdict === "UNVERIFIED") && Array.isArray(data.findings)) {
          setRejectFindings(data.findings.filter((f: any) => f.severity === "error" || f.severity === "warning"));
          setError(getVerificationMessage(data.verdict, data.findings));
        } else {
          throw new Error(data.error || (isAr ? "فشل رفع وثيقة التأمين" : "Échec du téléversement"));
        }
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        setIsOpen(false);
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      setError(err.message || (isAr ? "حدث خطأ أثناء الرفع" : "Une erreur est survenue"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          setIsOpen(true);
          setFile(null);
          setError(null);
          setSuccess(false);
        }}
        className="gap-1.5 text-xs font-semibold text-club-primary hover:bg-club-primary/10 border-club-primary/30"
      >
        <UploadCloud className="h-3.5 w-3.5" />
        <span>{isAr ? "رفع وثيقة التأمين" : "Téléverser l'assurance"}</span>
      </Button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="absolute inset-0" onClick={() => !isSubmitting && setIsOpen(false)} />

          <div className="relative z-10 w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl p-5 sm:p-6 text-foreground animate-in zoom-in-95">
            <div className="flex items-start justify-between gap-3 border-b border-border/80 pb-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-club-primary/20 bg-club-primary/10 text-club-primary">
                  <Shield className="h-5 w-5" />
                </div>
                <div className="min-w-0 space-y-1">
                  <h3 className="text-sm font-bold leading-snug sm:text-base">
                    {isAr ? "إيداع وثيقة التأمين الرياضي" : "Dépôt d'assurance sportive"}
                  </h3>
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
                    <span className="max-w-full truncate font-semibold text-muted-foreground">{playerName}</span>
                    {teamCategory && <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{teamCategory}</span>}
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsOpen(false)}
                aria-label={isAr ? "إغلاق" : "Fermer"}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/80 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {success ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto animate-bounce" />
                <p className="text-sm font-bold text-foreground">
                  {isAr ? "تم حفظ وثيقة التأمين وتحديث وضعية اللاعب بنجاح!" : "Document d'assurance enregistré avec succès !"}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <div className="rounded-xl border-2 border-dashed border-border/80 hover:border-club-primary/50 transition-colors p-4 text-center bg-muted/20">
                  <input
                    type="file"
                    id={`insurance-upload-${playerId}`}
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setFile(e.target.files[0]);
                        setError(null);
                      }
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor={`insurance-upload-${playerId}`}
                    className="flex flex-col items-center justify-center cursor-pointer space-y-2"
                  >
                    <UploadCloud className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <span className="text-xs font-semibold text-club-primary hover:underline">
                        {isAr ? "انقر لاختيار ملف الشهادة" : "Cliquer pour choisir le fichier"}
                      </span>
                      <p className="text-[10px] text-muted-foreground mt-0.5">PDF, PNG, JPG (Max 15MB)</p>
                    </div>
                  </label>
                </div>

                {file && (
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-xs text-foreground">
                    <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="font-mono truncate flex-1">{file.name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <DateInput
                      label={isAr ? "تاريخ بداية التأمين" : "Date début"}
                      value={startDate ? parseDMYToISO(startDate) ?? "" : ""}
                      onChange={(dmy) => setStartDate(dmy)}
                      placeholder="15/08/2026"
                      locale={locale}
                    />
                  </div>
                  <div>
                    <DateInput
                      label={isAr ? "تاريخ نهاية التأمين" : "Date fin"}
                      value={endDate ? parseDMYToISO(endDate) ?? "" : ""}
                      onChange={(dmy) => setEndDate(dmy)}
                      placeholder="30/06/2027"
                      required
                      locale={locale}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
                  <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">{isAr ? "ملء سريع" : "Remplissage rapide"}</span>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    aria-label={isAr ? "تعبئة تواريخ الموسم الرياضي" : "Remplir les dates de la saison sportive"}
                    onClick={() => {
                      setStartDate("15/08/2026");
                      setEndDate("30/06/2027");
                      setError(null);
                    }}
                    className="inline-flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-club-primary/25 bg-club-primary/5 px-2.5 py-1 text-start text-xs font-semibold text-club-primary transition-colors hover:border-club-primary/50 hover:bg-club-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-club-primary disabled:pointer-events-none disabled:opacity-50"
                  >
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                    <span>{isAr ? "الموسم الرياضي" : "Saison sportive"}</span>
                    <span dir="ltr" className="rounded-md bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">15/08/2026 — 30/06/2027</span>
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                    {isAr ? "مرجع وثيقة التأمين (اختياري)" : "Référence du document d'assurance (facultatif)"}
                  </label>
                  <input
                    type="text"
                    value={policyNumber}
                    placeholder={isAr ? "مثال: ASSUR-2026-9812" : "Exemple : ASSUR-2026-9812"}
                    onChange={(e) => setPolicyNumber(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-hidden focus:ring-1 focus:ring-club-primary"
                  />
                </div>

                {(error || rejectFindings.length > 0) && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-2.5 text-xs text-red-600 dark:text-red-400 space-y-1.5">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span className="font-semibold">{error}</span>
                    </div>
                    {rejectFindings.length > 0 && (
                      <ul className="mt-1 space-y-1 ps-6 list-none">
                        {rejectFindings.map((f, i) => {
                          const msgFn = findingMessages[f.code];
                          const msg = msgFn ? msgFn(f.params) : f.code;
                          return (
                            <li key={i} className="text-[11px] text-red-600 dark:text-red-400">
                              {msg}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/80">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isSubmitting}
                    onClick={() => setIsOpen(false)}
                  >
                    {isAr ? "إلغاء" : "Annuler"}
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmitting || !file}
                    className="gap-1.5"
                  >
                    {isSubmitting ? (
                      <span>{isAr ? "جارٍ الحفظ..." : "En cours..."}</span>
                    ) : (
                      <span>{isAr ? "تأكيد وتفعيل التأمين" : "Confirmer"}</span>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
