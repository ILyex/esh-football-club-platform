"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Eye, FileText, X } from "lucide-react";

type MatchDocument = {
  id: string;
  name: string;
  matchDocumentType: "PRE_MATCH_SHEET" | "REFEREE_REPORT" | null;
};

interface MatchDocumentPreviewButtonProps {
  matchId: string;
  matchTitle: string;
  locale: string;
  existingDocuments: MatchDocument[];
}

function getDocumentType(document: MatchDocument): MatchDocument["matchDocumentType"] {
  if (document.matchDocumentType) return document.matchDocumentType;
  const name = document.name.toLowerCase();
  if (document.name.includes("ورقة التشكيل") || /composition|line.?up|pre.?match|engagement|sheet|feuille/.test(name)) {
    return "PRE_MATCH_SHEET";
  }
  if (document.name.includes("تقرير حكم") || /rapport|referee|arbitre/.test(name)) {
    return "REFEREE_REPORT";
  }
  return null;
}

export function MatchDocumentPreviewButton({
  matchId,
  matchTitle,
  locale,
  existingDocuments
}: MatchDocumentPreviewButtonProps) {
  const isAr = locale === "ar";
  const [isOpen, setIsOpen] = useState(false);
  const documents = [...existingDocuments].sort((left, right) => {
    const order = (document: MatchDocument) => {
      const type = getDocumentType(document);
      return type === "PRE_MATCH_SHEET" ? 0 : type === "REFEREE_REPORT" ? 1 : 2;
    };
    return order(left) - order(right);
  });
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const activeDocument = documents.find((document) => document.id === activeDocumentId) ?? documents[0] ?? null;

  if (documents.length === 0) {
    return (
      <Link
        href={`/${locale}/dashboard/matches/${matchId}`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
        title={isAr ? "افتح سجل المباراة لرفع الوثائق أو مراجعتها" : "Ouvrir le match pour ajouter ou consulter ses documents"}
      >
        <FileText className="h-3.5 w-3.5 text-primary" />
        <span>{isAr ? "إدارة الوثائق" : "Gérer les documents"}</span>
      </Link>
    );
  }

  const getLabel = (document: MatchDocument) => {
    const type = getDocumentType(document);
    if (type === "PRE_MATCH_SHEET") return isAr ? "ورقة المباراة" : "Feuille de match";
    if (type === "REFEREE_REPORT") return isAr ? "تقرير الحكم" : "Rapport d’arbitrage";
    return document.name;
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/5 px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
        aria-label={isAr ? `عرض وثائق ${matchTitle}` : `Consulter les documents de ${matchTitle}`}
      >
        <Eye className="h-3.5 w-3.5" />
        <span>{isAr ? `الوثائق (${documents.length})` : `Documents (${documents.length})`}</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="match-documents-title"
            className="flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/40 p-4">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <h2 id="match-documents-title" className="text-sm font-bold">
                    {isAr ? "وثائق المباراة المحفوظة" : "Documents enregistrés du match"}
                  </h2>
                  <p className="truncate text-xs text-muted-foreground">{matchTitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/${locale}/dashboard/matches/${matchId}`}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                >
                  {isAr ? "إدارة الوثائق" : "Gérer les documents"}
                </Link>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label={isAr ? "إغلاق" : "Fermer"}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </header>

            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
              <nav className="flex flex-wrap gap-1" aria-label={isAr ? "وثائق المباراة" : "Documents du match"}>
                {documents.map((document) => (
                  <button
                    key={document.id}
                    type="button"
                    onClick={() => setActiveDocumentId(document.id)}
                    aria-current={activeDocument?.id === document.id ? "page" : undefined}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      activeDocument?.id === document.id ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {getLabel(document)}
                  </button>
                ))}
              </nav>
              {activeDocument && (
                <a
                  href={`/api/documents/${activeDocument.id}/download`}
                  download
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                >
                  <Download className="h-3.5 w-3.5" />
                  {isAr ? "تحميل" : "Télécharger"}
                </a>
              )}
            </div>

            <div className="min-h-0 flex-1 bg-white">
              {activeDocument ? (
                <iframe
                  key={activeDocument.id}
                  src={`/api/documents/${activeDocument.id}/download?inline=true`}
                  title={activeDocument.name}
                  className="h-full w-full border-0"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  {isAr ? "لا توجد وثيقة محددة." : "Aucun document sélectionné."}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
