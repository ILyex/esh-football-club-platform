"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

interface DeleteInsuranceButtonProps {
  playerId: string;
  documentId?: string;
  playerName: string;
  locale?: string;
}

export function DeleteInsuranceButton({
  playerId,
  documentId,
  playerName,
  locale = "ar"
}: DeleteInsuranceButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const isAr = locale === "ar";

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const url = documentId
        ? `/api/players/${playerId}/insurance?documentId=${encodeURIComponent(documentId)}`
        : `/api/players/${playerId}/insurance`;

      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ documentId: documentId || null })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || (isAr ? "فشل حذف وثيقة التأمين" : "Échec de la suppression"));
      }

      toast.success(
        isAr ? "تم حذف وثيقة التأمين بنجاح" : "Attestation d'assurance supprimée avec succès"
      );

      router.refresh();
      setTimeout(() => {
        window.location.reload();
      }, 350);
    } catch (err: any) {
      toast.error(err.message || (isAr ? "حدث خطأ أثناء الحذف" : "Une erreur est survenue"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ConfirmDialog
      onConfirm={handleDelete}
      title={isAr ? `حذف وثيقة تأمين ${playerName}` : `Supprimer l'assurance de ${playerName}`}
      body={
        isAr
          ? "هل أنت متأكد من أنك تريد حذف وثيقة التأمين الخاصة بهذا اللاعب؟ ستتغير حالة اللاعب إلى غير مؤمّن."
          : "Êtes-vous sûr de vouloir supprimer l'attestation d'assurance de ce joueur ?"
      }
    >
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={isDeleting}
        className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
        title={isAr ? "حذف وثيقة التأمين" : "Supprimer l'attestation"}
      >
        {isDeleting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </Button>
    </ConfirmDialog>
  );
}
