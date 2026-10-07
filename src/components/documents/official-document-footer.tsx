"use client";

interface OfficialDocumentFooterProps {
  locale?: string;
}

/** Shared footer for every official paper, anchored to the A4 page box. */
export function OfficialDocumentFooter({ locale = "ar" }: OfficialDocumentFooterProps) {
  // The shared season/club footer was removed from the official papers. Each
  // document now shows only the responsible department and its signatory.
  void locale;
  return null;
}
