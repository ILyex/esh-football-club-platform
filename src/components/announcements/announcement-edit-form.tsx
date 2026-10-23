"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateAnnouncementAction } from "@/app/[locale]/(dashboard)/dashboard/announcements/actions";

export function AnnouncementEditForm({
  announcementId,
  locale,
  children
}: {
  announcementId: string;
  locale: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const isArabic = locale === "ar";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;

    submitting.current = true;
    setPending(true);
    const formData = new FormData(event.currentTarget);
    try {
      await updateAnnouncementAction(announcementId, formData);
      toast.success(isArabic ? "تم حفظ تعديلات الإعلان بنجاح" : "Modifications de l’annonce enregistrées");
      router.refresh();
    } catch {
      toast.error(isArabic ? "تعذر حفظ تعديلات الإعلان. تحقق من البيانات وحاول مجدداً." : "Impossible d’enregistrer l’annonce. Vérifiez les données et réessayez.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-busy={pending} encType="multipart/form-data" className="space-y-5">
      {children}
    </form>
  );
}
