"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import { Camera, Trash2, Upload, User, Loader2, Check, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { removePlayerPhotoAction } from "@/app/[locale]/(dashboard)/dashboard/players/actions";
import { IMAGE_UPLOAD_ACTION, IMAGE_UPLOAD_FRAME, IMAGE_UPLOAD_PREVIEW } from "@/components/ui/image-upload-frame";

interface PlayerPhotoEditorProps {
  playerId: string;
  currentPhotoUrl: string | null;
  playerName: string;
  canUpdate: boolean;
  locale: string;
}

export function PlayerPhotoEditor({
  playerId,
  currentPhotoUrl,
  playerName,
  canUpdate,
  locale
}: PlayerPhotoEditorProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(currentPhotoUrl);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [removeMarked, setRemoveMarked] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const isAr = locale === "ar";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      setRemoveMarked(false);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleRemovePhoto = () => {
    if (!photoUrl && !previewUrl) return;

    if (previewUrl) {
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    startTransition(async () => {
      try {
        await removePlayerPhotoAction(playerId);
        setPhotoUrl(null);
        setRemoveMarked(true);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (err) {
        console.error("Failed to remove photo:", err);
      }
    });
  };

  const activeDisplayUrl = previewUrl || (removeMarked ? null : photoUrl);

  return (
    <div className={`${IMAGE_UPLOAD_FRAME} flex-col items-stretch space-y-3 p-4`}>
      <div className="flex items-center justify-between">
        <label className="block text-sm font-bold text-foreground">
          {isAr ? "صورة اللاعب الرسمية" : "Photo Officielle du Joueur"}
        </label>
        {activeDisplayUrl && (
          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <Check className="h-3 w-3" />
            <span>{isAr ? "صورة معتمدة" : "Photo chargée"}</span>
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        {/* Photo Avatar / Preview */}
        <div className="relative group shrink-0">
          <div className={`${IMAGE_UPLOAD_PREVIEW} h-24 w-24 rounded-2xl bg-muted/80 shadow-inner`}>
            {activeDisplayUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeDisplayUrl}
                alt={playerName}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground/60 p-2 text-center">
                <User className="h-10 w-10 stroke-[1.5]" />
                <span className="text-[10px] mt-1 font-semibold">{isAr ? "بدون صورة" : "Sans photo"}</span>
              </div>
            )}
          </div>

          {canUpdate && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-2 -end-2 p-1.5 rounded-full bg-club-primary text-white shadow-md hover:bg-club-primary-hover transition-colors"
              title={isAr ? "تغيير الصورة" : "Modifier la photo"}
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Controls & Description */}
        <div className="flex-1 space-y-2 text-start w-full">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {isAr
              ? "الصورة الرسمية تظهر في بطاقة اللاعب، الموقع الرسمي للنادي، ومحاضر المباريات وقوائم الفئات."
              : "La photo officielle apparaît sur la fiche du joueur, le site web public et les feuilles de match."}
          </p>

          {canUpdate && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className={IMAGE_UPLOAD_ACTION}
              >
                <Upload className="h-3.5 w-3.5 me-1.5 text-muted-foreground" />
                <span>{activeDisplayUrl ? (isAr ? "تعديل / تغيير الصورة" : "Changer la photo") : (isAr ? "رفع صورة جديدة" : "Uploader une photo")}</span>
              </Button>

              {activeDisplayUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRemovePhoto}
                  disabled={isPending}
                  className="text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-900/40"
                >
                  {isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin me-1.5" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5 me-1.5" />
                  )}
                  <span>{isAr ? "حذف الصورة" : "Supprimer la photo"}</span>
                </Button>
              )}
            </div>
          )}

          {previewUrl && (
            <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0" />
              <span>
                {isAr
                  ? "تم اختيار صورة جديدة. يرجى الضغط على زر حفظ في أسفل النموذج لحفظ التغيير."
                  : "Nouvelle photo sélectionnée. Cliquez sur 'Sauvegarder' pour confirmer."}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Hidden inputs wired to the parent form */}
      <input
        ref={fileInputRef}
        type="file"
        name="photo"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        disabled={!canUpdate || isPending}
        className="hidden"
      />
      <input type="hidden" name="removePhoto" value={removeMarked ? "true" : "false"} />
    </div>
  );
}
