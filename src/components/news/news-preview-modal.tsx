"use client";

import { useState } from "react";
import { Eye, X, Calendar, Tag, Shield, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface NewsPreviewModalProps {
  locale: string;
  titleAr?: string | null;
  contentAr?: string | null;
  titleFr?: string | null;
  contentFr?: string | null;
  category?: string | null;
  tags?: string[] | null;
  imageUrl?: string | null;
  status?: string;
  scheduledFor?: Date | string | null;
  buttonLabel?: string;
}

export function NewsPreviewModal({
  locale,
  titleAr,
  contentAr,
  titleFr,
  contentFr,
  category,
  tags,
  imageUrl,
  status = "DRAFT",
  scheduledFor,
  buttonLabel
}: NewsPreviewModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeLang, setActiveLang] = useState<"ar" | "fr">(locale === "fr" ? "fr" : "ar");

  const isAr = activeLang === "ar";
  const displayTitle = isAr ? (titleAr || titleFr || "عنوان الخبر التجريبي") : (titleFr || titleAr || "Titre de l'actualité");
  const displayContent = isAr
    ? (contentAr || contentFr || "محتوى المقال الإخباري يظهر هنا بنسق احترافي كما يراه الزوار في الموقع الرسمي للنادي...")
    : (contentFr || contentAr || "Le contenu de l'actualité s'affichera ici avec une mise en page identique à celle du site public...");

  const formattedDate = new Intl.DateTimeFormat(isAr ? "ar-DZ" : "fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(scheduledFor ? new Date(scheduledFor) : new Date());

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-2xs"
      >
        <Eye className="h-3.5 w-3.5 text-club-primary" />
        <span>{buttonLabel || (locale === "ar" ? "معاينة قبل النشر" : "Aperçu avant publication")}</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            dir={isAr ? "rtl" : "ltr"}
          >
            {/* Header Toolbar */}
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-club-primary/10 text-club-primary">
                  <Eye className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-xs font-bold text-foreground">
                    {locale === "ar" ? "معاينة الخبر في الموقع الرسمي" : "Aperçu de l'actualité sur le site public"}
                  </h2>
                  <p className="text-[10px] text-muted-foreground">
                    {locale === "ar" ? "هكذا سيظهر المقال تماماً لزوار الموقع" : "Rendu fidèle tel que vu par les visiteurs"}
                  </p>
                </div>
              </div>

              {/* Language Switcher inside Preview */}
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-border bg-background p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveLang("ar")}
                    className={`px-2.5 py-1 rounded-md font-semibold transition ${
                      activeLang === "ar" ? "bg-club-primary text-white" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    العربية
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveLang("fr")}
                    className={`px-2.5 py-1 rounded-md font-semibold transition ${
                      activeLang === "fr" ? "bg-club-primary text-white" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Français
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Simulated Public Article Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-background">
              {/* Category, Date & Status */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  {category && (
                    <Badge tone="neutral" className="uppercase tracking-wider text-[11px] font-bold">
                      {category}
                    </Badge>
                  )}
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{formattedDate}</span>
                  </span>
                </div>

                <Badge tone={status === "PUBLISHED" ? "success" : "warning"} className="text-[10px]">
                  {status === "PUBLISHED"
                    ? (locale === "ar" ? "منشور على الموقع" : "Publié")
                    : (locale === "ar" ? "مسودة (غير معروض للعامة)" : "Brouillon (non public)")}
                </Badge>
              </div>

              {/* Headline */}
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-snug">
                {displayTitle}
              </h1>

              {/* Featured Image */}
              {imageUrl ? (
                <div className="overflow-hidden rounded-xl border border-border shadow-xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt={displayTitle} className="w-full max-h-80 object-cover" />
                </div>
              ) : (
                <div className="h-40 rounded-xl border border-dashed border-border bg-muted/20 flex flex-col items-center justify-center text-muted-foreground text-xs">
                  <Shield className="h-8 w-8 mb-1 opacity-30" />
                  <span>{locale === "ar" ? "لا توجد صورة بارزة مرفقة" : "Aucune image principale"}</span>
                </div>
              )}

              {/* Article Content */}
              <div className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed whitespace-pre-line text-sm pt-2">
                {displayContent}
              </div>

              {/* Tags */}
              {tags && tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-4 border-t border-border/60">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  {tags.map((t, idx) => (
                    <span key={idx} className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground font-mono">
                      #{t.trim()}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border bg-muted/30 px-5 py-3 text-xs text-muted-foreground">
              <span>Association Sportive Espoir Sidi Hosni de Football • CMS Preview</span>
              <Button size="sm" variant="outline" onClick={() => setIsOpen(false)}>
                {locale === "ar" ? "إغلاق المعاينة" : "Fermer l'aperçu"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
