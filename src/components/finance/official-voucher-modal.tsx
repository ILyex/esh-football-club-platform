"use client";

import { useState } from "react";
import { Printer, X, FileText, Shield, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { amountToWordsArabic, amountToWordsFrench } from "@/lib/finance/number-to-words";
import { printDocumentElement } from "@/lib/documents/print-helper";
import { OfficialDocumentHeader } from "@/components/documents/official-document-header";
import { ESH_DOCUMENT_FONT_FAMILY, ESH_WATERMARK_CSS_URL } from "@/lib/documents/watermark";

interface OfficialVoucherModalProps {
  type: "DEPOSIT" | "WITHDRAWAL" | "EXPENSE";
  referenceNumber: string;
  amount: number;
  date: Date | string;
  beneficiaryOrSource: string;
  nationalIdNumber?: string | null;
  purpose: string;
  accountName?: string;
  documentId?: string | null;
  documentName?: string | null;
  locale?: string;
  buttonLabel?: string;
  className?: string;
}

export function OfficialVoucherModal({
  type,
  referenceNumber,
  amount,
  date,
  beneficiaryOrSource,
  nationalIdNumber,
  purpose,
  accountName,
  documentId,
  documentName,
  locale = "ar",
  buttonLabel,
  className
}: OfficialVoucherModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  const isDeposit = type === "DEPOSIT";
  const isExpense = type === "EXPENSE";
  const isWithdrawal = type === "WITHDRAWAL";
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const formattedDate = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(dateObj);

  const amountInWords =
    locale === "ar" ? amountToWordsArabic(amount) : amountToWordsFrench(amount);

  const voucherElementId = `esh-voucher-${referenceNumber.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const documentTitle =
    locale === "ar"
      ? isExpense
        ? "فاتورة صرف"
        : isDeposit
          ? "وصل إيداع"
          : "وصل سحب"
      : isExpense
        ? "Facture de Dépense"
        : isDeposit
          ? "Bon de Versement"
          : "Bon de Retrait";

  const handlePrint = () => {
    printDocumentElement(
      voucherElementId,
      `${documentTitle} — Association Sportive Espoir Sidi Hosni de Football`
    );
  };

  const defaultLabel =
    buttonLabel ||
    (locale === "ar"
      ? isExpense
        ? "معاينة الفاتورة"
        : isDeposit
          ? "معاينة وصل الإيداع"
          : "معاينة وصل السحب"
      : isExpense
        ? "Voir la facture"
        : isDeposit
          ? "Reçu de versement"
          : "Bon de retrait");

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
          isExpense ? "border-red-500/30 text-red-700 hover:bg-red-500/10 dark:text-red-400" : ""
        } ${className ?? ""}`}
      >
        <FileText className={`h-3.5 w-3.5 ${isExpense ? "text-red-600 dark:text-red-400" : "text-club-primary"}`} />
        <span>{defaultLabel}</span>
      </Button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
        >
          {/* Backdrop Dismiss */}
          <div className="absolute inset-0" onClick={() => setIsOpen(false)} />

          {/* Dialog Container */}
          <div className="relative z-10 flex flex-col w-full max-w-4xl sm:max-w-5xl max-h-[92vh] bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
            {/* Modal Actions Header (Hidden on Print) */}
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3 shrink-0 print:hidden">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-club-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  {documentTitle} — Association Sportive Espoir Sidi Hosni de Football
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {documentId && (
                  <a
                    href={`/api/documents/${documentId}/download`}
                    download
                    className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/40 bg-purple-500/10 px-2.5 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-500/20 dark:text-purple-300 transition-colors"
                    title={documentName || "Document"}
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    <span>{locale === "ar" ? "تحميل المرفق الأصلي" : "Télécharger pièce"}</span>
                  </a>
                )}
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={handlePrint}
                  className="gap-1.5 text-xs font-bold"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>{locale === "ar" ? "طباعة" : "Imprimer"}</span>
                </Button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Printable Official Voucher Document Body */}
            <div
              id={voucherElementId}
              className="printable-document esh-security-watermark relative flex-1 overflow-y-auto p-4 sm:p-6 bg-white text-black print:p-0 print:m-0 print:bg-white print:text-black w-full"
              dir={locale === "ar" ? "rtl" : "ltr"}
              style={{
                fontFamily: ESH_DOCUMENT_FONT_FAMILY,
                direction: locale === "ar" ? "rtl" : "ltr",
                unicodeBidi: "plaintext",
                pageBreakInside: "avoid",
                breakInside: "avoid"
              }}
            >
              {/* Dedicated Visible Anti-Counterfeit Watermark Pattern Layer */}
              <div
                className="pointer-events-none absolute inset-0 z-0 select-none print:hidden opacity-100"
                style={{
                  backgroundImage: ESH_WATERMARK_CSS_URL,
                  backgroundSize: "100px 50px",
                  backgroundRepeat: "repeat"
                }}
                aria-hidden="true"
              />

              {/* Document Content on top of watermark */}
              <div className="relative z-10">
                {/* Official Institutional Header */}
                <OfficialDocumentHeader
                  badgeText={
                    locale === "ar"
                      ? (isExpense ? "فاتورة صرف" : isDeposit ? "وصل إيداع" : "وصل سحب")
                      : (isExpense ? "FACTURE" : isDeposit ? "BON DE VERSEMENT" : "BON DE RETRAIT")
                  }
                  documentTitle={documentTitle}
                  referenceNumber={referenceNumber}
                  date={date}
                  locale={locale}
                  className="mb-3"
                />

                {/* Official Statement Body */}
                <div className="space-y-4 text-[16px] sm:text-[17px] leading-relaxed text-black my-4">
                  <p className="text-[16px] sm:text-[17px]">
                    {locale === "ar" ? (
                      <>
                        تشهد <strong>الجمعية الرياضية أمل سيدي حسني لكرة القدم</strong> ممثلةً في أمانة الخزينة، بأن المعني بالعملية:{" "}
                        <strong>{beneficiaryOrSource || "إدارة النادي"}</strong>
                        {nationalIdNumber && (
                          <>، الحامل لبطاقة التعريف الوطنية رقم: <strong className="font-mono">[{nationalIdNumber}]</strong></>
                        )}
                        ، قام بـ{isExpense ? "صرف المستحقات المذكورة أدناه:" : isDeposit ? "إيداع المبلغ المالي المذكور أدناه في حساب النادي:" : "سحب المبلغ المالي المذكور أدناه من صندوق/خزينة النادي:"}
                      </>
                    ) : (
                      <>
                        L&apos;association <strong>Association Sportive Espoir Sidi Hosni de Football</strong>, représentée par la trésorerie générale, atteste que :{" "}
                        <strong>{beneficiaryOrSource || "Administration du club"}</strong>
                        {nationalIdNumber && (
                          <>, titulaire de la CNI n° <strong className="font-mono">[{nationalIdNumber}]</strong></>
                        )}
                        , a effectué l&apos;opération suivante :
                      </>
                    )}
                  </p>

                  <div className="py-2 px-1 space-y-2 text-black">
                    <div className="grid grid-cols-3 gap-3 items-center py-0.5">
                      <span className="font-bold text-black text-[15px] sm:text-[16px]">
                        {locale === "ar"
                          ? "المعني بالعملية:"
                          : "Bénéficiaire / Concerné :"}
                      </span>
                      <span className="col-span-2 font-bold text-black text-[16px] sm:text-[17px]">
                        {beneficiaryOrSource || (isExpense ? (locale === "ar" ? "مصاريف تشغيلية عامة" : "Dépenses opérationnelles") : (locale === "ar" ? "إدارة النادي / الحساب العام" : "Administration du club / Compte général"))}
                        {nationalIdNumber && (
                          <span className="block text-xs font-mono font-normal text-zinc-700 mt-0.5">
                            {locale === "ar" ? `رقم ب.ت.و: ${nationalIdNumber}` : `N° CNI: ${nationalIdNumber}`}
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 items-center py-0.5">
                      <span className="font-bold text-black text-[15px] sm:text-[16px]">
                        {locale === "ar" ? "المبلغ بالأرقام:" : "Montant en chiffres :"}
                      </span>
                      <div className="col-span-2 flex items-baseline gap-2">
                        <span
                          className="font-black text-[21px] sm:text-[23px] text-black"
                          style={{ fontFamily: ESH_DOCUMENT_FONT_FAMILY }}
                        >
                          {amount.toLocaleString(locale === "ar" ? "ar-DZ" : "fr-DZ")}
                        </span>
                        <span className="font-bold text-[15px] sm:text-[16px] text-black">
                          {locale === "ar" ? "دينار جزائري" : "Dinars Algériens"}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 items-center py-0.5">
                      <span className="font-bold text-black text-[15px] sm:text-[16px]">
                        {locale === "ar" ? "المبلغ بالحروف:" : "Montant en lettres :"}
                      </span>
                      <span className="col-span-2 font-bold text-black text-[16px] sm:text-[17px]">
                        {amountInWords}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 items-start py-0.5">
                      <span className="font-bold text-black text-[15px] sm:text-[16px]">
                        {locale === "ar"
                          ? isExpense ? "طبيعة النفقة / البيان:" : "الغرض / التبرير:"
                          : isExpense ? "Nature de la dépense / Objet :" : "Motif / Justification :"}
                      </span>
                      <span className="col-span-2 text-black text-[15px] sm:text-[16px] leading-relaxed">
                        {purpose || (isExpense ? (locale === "ar" ? "مصاريف تسيير الفريق والنشاط الرياضي" : "Frais de gestion et activités sportives") : isDeposit ? (locale === "ar" ? "إعانة / تمويل مالي للنادي" : "Subvention / Financement du club") : (locale === "ar" ? "مصاريف تسيير الفريق والنشاط الرياضي" : "Frais de gestion et activités sportives"))}
                      </span>
                    </div>

                    {accountName && (
                      <div className="grid grid-cols-3 gap-3 items-center py-0.5">
                        <span className="font-bold text-black text-[15px] sm:text-[16px]">
                          {locale === "ar" ? "الحساب المالي:" : "Compte financier :"}
                        </span>
                        <span className="col-span-2 font-medium text-black text-[15px] sm:text-[16px]">
                          {accountName} ({locale === "ar" ? "حساب النادي المركزي" : "Compte central du club"})
                        </span>
                      </div>
                    )}
                  </div>

                  <p className="text-[12px] sm:text-[13px] text-zinc-600 leading-normal pt-1">
                    {locale === "ar"
                      ? "* سُجلت هذه المعاملة ضمن السجل المالي والمحاسبي للنادي طبقا للتشريع المعمول به في تسيير الجمعيات الرياضية."
                      : "* Cette opération est enregistrée dans la comptabilité du club conformément à la législation régissant les associations sportives."}
                  </p>
                </div>

                {/* Triple Signature Blocks strictly by role only, zero decorative lines */}
                <div
                  className="grid grid-cols-3 gap-6 pt-6 mt-6 text-center text-black"
                  style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
                >
                  <div>
                    <p className="text-[15px] sm:text-[16px] font-bold text-black">
                      {locale === "ar"
                        ? isExpense
                          ? "المستفيد"
                          : isDeposit
                            ? "المودع"
                            : "المستلم"
                        : isExpense
                          ? "Le Bénéficiaire"
                          : isDeposit
                            ? "Le Déposant"
                            : "Le Réceptionnaire"}
                    </p>
                    <div className="h-20" />
                  </div>

                  <div>
                    <p className="text-[15px] sm:text-[16px] font-bold text-black">
                      {locale === "ar" ? "أمين الخزينة" : "Le Trésorier Général"}
                    </p>
                    <div className="h-20" />
                  </div>

                  <div>
                    <p className="text-[15px] sm:text-[16px] font-bold text-black">
                      {locale === "ar" ? "رئيس النادي" : "Le Président du Club"}
                    </p>
                    <div className="h-20" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
