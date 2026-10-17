"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function AnnouncementCreatedNotice({ locale, created }: { locale: string; created: boolean }) {
  useEffect(() => {
    if (created) toast.success(locale === "ar" ? "تم حفظ الإعلان بنجاح" : "Annonce enregistrée avec succès");
  }, [created, locale]);

  return null;
}
