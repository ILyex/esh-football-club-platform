"use client";

import { useState, useRef, useEffect, ChangeEvent, DragEvent } from "react";
import { UploadCloud, Image as ImageIcon, Video as VideoIcon, Play, Trash2, ArrowLeft, ArrowRight, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isVideoUrl } from "@/lib/media-utils";

export interface ExistingImage {
  id?: string;
  url: string;
  caption?: string;
}

interface ImageItem {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
  size: string;
  isVideo: boolean;
}

interface MultiImageUploaderProps {
  name?: string;
  locale?: string;
  label?: string;
  description?: string;
  existingImages?: ExistingImage[];
  onRemoveExisting?: (urlOrId: string) => void;
  maxFiles?: number;
  className?: string;
  allowVideo?: boolean;
}

export function MultiImageUploader({
  name = "images",
  locale = "ar",
  label,
  description,
  existingImages = [],
  onRemoveExisting,
  maxFiles = 30,
  className = "",
  allowVideo = true
}: MultiImageUploaderProps) {
  const isAr = locale === "ar";
  const [items, setItems] = useState<ImageItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [removedExistingUrls, setRemovedExistingUrls] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Allow parent forms to clear a completed create form with the native reset event.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const handleFormReset = () => {
      itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setItems([]);
      setRemovedExistingUrls([]);
    };
    form.addEventListener("reset", handleFormReset);
    return () => form.removeEventListener("reset", handleFormReset);
  }, []);

  // Sync internal items with native file input using DataTransfer
  const syncInputFiles = (currentItems: ImageItem[]) => {
    if (!inputRef.current) return;
    try {
      const dt = new DataTransfer();
      currentItems.forEach((item) => dt.items.add(item.file));
      inputRef.current.files = dt.files;
    } catch {
      // In non-supporting environments, files array remains
    }
  };

  const handleFilesAdded = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files).filter((file) => {
      const isImg = file.type.startsWith("image/");
      const isVid = allowVideo && file.type.startsWith("video/");
      return isImg || isVid;
    });

    if (newFiles.length === 0) return;

    const newItems: ImageItem[] = newFiles.map((file) => {
      const isVid = file.type.startsWith("video/");
      return {
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        previewUrl: URL.createObjectURL(file),
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(2) + " MB",
        isVideo: isVid
      };
    });

    setItems((prev) => {
      const updated = [...prev, ...newItems].slice(0, maxFiles);
      syncInputFiles(updated);
      return updated;
    });
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFilesAdded(e.target.files);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const removeItem = (index: number) => {
    setItems((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      const updated = prev.filter((_, i) => i !== index);
      syncInputFiles(updated);
      return updated;
    });
  };

  const moveItem = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= items.length) return;
    setItems((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      if (moved) {
        updated.splice(toIndex, 0, moved);
      }
      syncInputFiles(updated);
      return updated;
    });
  };

  const makeCover = (index: number) => {
    if (index === 0) return;
    moveItem(index, 0);
  };

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  const handleRemoveExisting = (url: string) => {
    setRemovedExistingUrls((prev) => [...prev, url]);
    if (onRemoveExisting) onRemoveExisting(url);
  };

  const activeExisting = existingImages.filter(
    (img) => !removedExistingUrls.includes(img.url)
  );

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Label and Info */}
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-semibold text-foreground">
            {label ?? (isAr ? "معرض الصور (إضافة متعددة مع المعاينة والترتيب)" : "Galerie d'images (Ajout multiple et tri)")}
          </label>
          <p className="text-xs text-muted-foreground mt-0.5">
            {description ?? (isAr
              ? "يمكنك سحب وإفلات أو اختيار عدة صور، ثم مشاهدة ترتيبها وتغييره قبل الحفظ (الصورة رقم 1 هي الغلاف)"
              : "Sélectionnez plusieurs photos, prévisualisez-les et modifiez l'ordre avant d'enregistrer")}
          </p>
        </div>
        {items.length > 0 && (
          <span className="text-xs font-bold text-primary px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
            {items.length} {isAr ? "صور محددة" : "sélectionnées"}
          </span>
        )}
      </div>

      {/* Hidden real file input */}
      <input
        ref={inputRef}
        type="file"
        name={name}
        multiple
        accept={allowVideo ? "image/png,image/jpeg,image/webp,video/mp4,video/webm" : "image/png,image/jpeg,image/webp,image/avif"}
        className="hidden"
        onChange={handleInputChange}
      />

      {/* Hidden field to send removed existing image URLs if any */}
      {removedExistingUrls.map((url) => (
        <input key={url} type="hidden" name="removedImages" value={url} />
      ))}

      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 ${
          isDragging
            ? "border-primary bg-primary/10 scale-[1.01]"
            : "border-border hover:border-primary/50 hover:bg-muted/30 bg-card"
        }`}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
          <UploadCloud className="h-6 w-6" />
        </div>
        <p className="text-sm font-semibold text-foreground text-center">
          {isAr
            ? (allowVideo ? "انقر لاختيار عدة صور أو فيديوهات، أو اسحبها إلى هنا" : "انقر لاختيار عدة صور دفعة واحدة أو اسحبها إلى هنا")
            : (allowVideo ? "Cliquez pour sélectionner des photos/vidéos ou glissez-déposez-les ici" : "Cliquez pour sélectionner des photos ou glissez-déposez-les ici")}
        </p>
        <p className="text-xs text-muted-foreground mt-1 text-center">
          {isAr
            ? (allowVideo ? "الصور: PNG وJPG وWebP (حتى 8 ميغابايت) — الفيديوهات: MP4 وWebM (حتى 35 ميغابايت)" : "صيغ الصور المدعومة: PNG وJPG وWebP — يمكنك إضافة 30 صورة كحد أقصى")
            : (allowVideo ? "Photos (JPG, PNG max 8MB) & Vidéos (MP4, WebM max 35MB)" : "Formats acceptés : PNG, JPG, WebP (jusqu'à 30 images)")}
        </p>
      </div>

      {/* ── Active Existing Images (if in edit mode) ── */}
      {activeExisting.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
            <ImageIcon className="h-3.5 w-3.5" />
            <span>{isAr ? "الوسائط الحالية المحفوظة مسبقاً:" : "Médias actuellement enregistrés :"}</span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {activeExisting.map((img, idx) => {
              const isVid = isVideoUrl(img.url);
              return (
                <div
                  key={img.url || idx}
                  className="group relative rounded-xl border border-border bg-card overflow-hidden shadow-xs hover:border-primary/40 transition-all"
                >
                  <div className="relative aspect-[4/3] min-h-[140px] w-full bg-muted">
                    {isVid ? (
                      <div className="relative h-full w-full bg-black/90 flex items-center justify-center">
                        <video src={img.url} className="h-full w-full object-cover" preload="metadata" />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                          <Play className="h-7 w-7 text-white fill-white/80" />
                        </span>
                        <span className="absolute bottom-2 start-2 bg-black/80 text-white text-[10px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1">
                          <VideoIcon className="h-3 w-3 text-sky-400" />
                          <span>فيديو</span>
                        </span>
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img.url}
                        alt={img.caption || ""}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = "/branding/esh-logo-256.png";
                        }}
                        className="h-full w-full object-cover"
                      />
                    )}

                    {idx === 0 && (
                      <span className="absolute top-2 start-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                        <Star className="h-2.5 w-2.5 fill-white" />
                        <span>{isAr ? "الغلاف الحالي" : "Couverture"}</span>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveExisting(img.url);
                      }}
                      className="absolute top-2 end-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-destructive transition-colors cursor-pointer"
                      title={isAr ? "حذف هذا الملف" : "Supprimer"}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {img.caption && (
                    <p className="p-1.5 text-[11px] text-muted-foreground truncate">{img.caption}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Selected New Images with Order & Controls ── */}
      {items.length > 0 && (
        <div className="space-y-2.5 pt-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <span>{isAr ? "الصور الجديدة المختارة (الترتيب الفعلي قبل الحفظ):" : "Nouvelles photos sélectionnées (ordre avant sauvegarde) :"}</span>
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                items.forEach((it) => URL.revokeObjectURL(it.previewUrl));
                setItems([]);
                syncInputFiles([]);
              }}
              className="h-6 text-xs text-destructive hover:bg-destructive/10 px-2"
            >
              {isAr ? "مسح الكل" : "Tout effacer"}
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {items.map((item, index) => {
              const isFirst = index === 0;
              const isLast = index === items.length - 1;

              return (
                <div
                  key={item.id}
                  className={`group relative rounded-xl border overflow-hidden shadow-xs transition-all ${
                    isFirst
                      ? "border-emerald-500/60 ring-2 ring-emerald-500/20 bg-emerald-50/10 dark:bg-emerald-950/10"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-[4/3] min-h-[140px] w-full bg-muted">
                    {item.isVideo ? (
                      <div className="relative h-full w-full bg-black/90 flex items-center justify-center">
                        <video src={item.previewUrl} className="h-full w-full object-cover" preload="metadata" />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                          <Play className="h-7 w-7 text-white fill-white/80" />
                        </span>
                        <span className="absolute bottom-2 start-2 bg-black/80 text-white text-[10px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1">
                          <VideoIcon className="h-3 w-3 text-sky-400" />
                          <span>فيديو</span>
                        </span>
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.previewUrl} alt={item.name} className="h-full w-full object-cover" />
                    )}

                    {/* Order Badge */}
                    <div className="absolute top-2 start-2 flex items-center gap-1">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/75 text-[11px] font-black text-white shadow-xs">
                        #{index + 1}
                      </span>
                      {isFirst && (
                        <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                          <Star className="h-2.5 w-2.5 fill-white" />
                          <span>{isAr ? "الغلاف" : "Couverture"}</span>
                        </span>
                      )}
                    </div>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="absolute top-2 end-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-destructive transition-colors cursor-pointer"
                      title={isAr ? "إزالة" : "Supprimer"}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Info and Reordering toolbar */}
                  <div className="p-2 space-y-1.5 bg-card border-t border-border/60">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="truncate max-w-[100px]" title={item.name}>{item.name}</span>
                      <span>{item.size}</span>
                    </div>

                    <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/40">
                      {/* Move left / previous */}
                      <button
                        type="button"
                        disabled={isFirst}
                        onClick={() => moveItem(index, index - 1)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
                        title={isAr ? "تحريك للأمام" : "Déplacer avant"}
                      >
                        {isAr ? <ArrowRight className="h-3.5 w-3.5" /> : <ArrowLeft className="h-3.5 w-3.5" />}
                      </button>

                      {/* Make cover button */}
                      {!isFirst && (
                        <button
                          type="button"
                          onClick={() => makeCover(index)}
                          className="px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded cursor-pointer transition-colors"
                          title={isAr ? "تعيين كغلاف أول" : "Définir comme couverture"}
                        >
                          {isAr ? "اجعلها غلاف" : "Couverture"}
                        </button>
                      )}

                      {/* Move right / next */}
                      <button
                        type="button"
                        disabled={isLast}
                        onClick={() => moveItem(index, index + 1)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
                        title={isAr ? "تحريك للخلف" : "Déplacer après"}
                      >
                        {isAr ? <ArrowLeft className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
