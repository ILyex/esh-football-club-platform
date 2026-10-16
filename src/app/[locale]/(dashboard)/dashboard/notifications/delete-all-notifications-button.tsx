"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteAllNotificationsAction } from "./actions";

export function DeleteAllNotificationsButton({ locale }: { locale: string }) {
  const router = useRouter();
  const isAr = locale === "ar";

  async function deleteAll() {
    const result = await deleteAllNotificationsAction();
    router.refresh();
    return result;
  }

  return (
    <ConfirmDialog
      onConfirm={deleteAll}
      title={isAr ? "حذف جميع الإشعارات؟" : "Supprimer toutes les notifications ?"}
      body={isAr
        ? "سيتم حذف جميع الإشعارات من حسابك نهائيًا. لا يمكن التراجع عن هذا الإجراء."
        : "Toutes les notifications de votre compte seront supprimées définitivement. Cette action est irréversible."}
      successMessage={isAr ? "تم حذف جميع الإشعارات" : "Toutes les notifications ont été supprimées"}
      errorMessage={isAr ? "تعذر حذف الإشعارات. حاول مرة أخرى." : "Impossible de supprimer les notifications. Réessayez."}
    >
      <Button type="button" variant="destructive" size="sm" className="gap-1.5 text-xs font-semibold">
        <Trash2 className="h-4 w-4" />
        <span>{isAr ? "حذف جميع الإشعارات" : "Tout supprimer"}</span>
      </Button>
    </ConfirmDialog>
  );
}
