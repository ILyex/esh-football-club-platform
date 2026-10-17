"use client";

import { useEffect, useRef, useState, useTransition, type ChangeEvent } from "react";
import { ImagePlus, LoaderCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateWebsiteImageSlotAction, type WebsiteImageSlot } from "@/app/[locale]/(dashboard)/dashboard/website/actions";
import { isVideoUrl } from "@/lib/media-utils";

type Slot = { id: WebsiteImageSlot; title: string; dimensions: string; fallback: string };

const slots: Slot[] = [
  { id: "teamSenior", title: "صورة فريق الأكابر", dimensions: "1920 × 1080 px", fallback: "/branding/teams/category-senior.jpg" },
  { id: "teamU20", title: "صورة فريق U20", dimensions: "1920 × 1080 px", fallback: "/branding/teams/category-u20.jpg" },
  { id: "teamU17", title: "صورة فريق U17", dimensions: "1920 × 1080 px", fallback: "/branding/teams/category-u17.jpg" },
  { id: "teamU15", title: "صورة فريق U15", dimensions: "1920 × 1080 px", fallback: "/branding/teams/category-u15.jpg" },
  { id: "introPoster", title: "صورة غلاف فيديو التعريف", dimensions: "1920 × 1080 px", fallback: "/branding/esh-intro-poster.jpg" }
];

export function WebsiteImageSlotsManager({ images, onVercel = false }: { images: Record<string, string>; onVercel?: boolean }) {
  const [saved, setSaved] = useState(images);
  const [selected, setSelected] = useState<Partial<Record<WebsiteImageSlot, File>>>({});
  const [previews, setPreviews] = useState<Partial<Record<WebsiteImageSlot, string>>>({});
  const previewUrls = useRef<Partial<Record<WebsiteImageSlot, string>>>({});
  const [feedback, setFeedback] = useState<Partial<Record<WebsiteImageSlot, { ok: boolean; text: string }>>>({});
  const [busySlot, setBusySlot] = useState<WebsiteImageSlot | null>(null);
  const [isSaving, startSaving] = useTransition();

  useEffect(() => () => Object.values(previewUrls.current).forEach((url) => url && URL.revokeObjectURL(url)), []);

  const pick = (slot: Slot, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const oldPreview = previewUrls.current[slot.id];
    if (oldPreview) URL.revokeObjectURL(oldPreview);
    const preview = URL.createObjectURL(file);
    previewUrls.current[slot.id] = preview;
    setSelected((value) => ({ ...value, [slot.id]: file }));
    setPreviews((value) => ({ ...value, [slot.id]: preview }));
    setFeedback((value) => ({ ...value, [slot.id]: undefined }));
  };

  const save = (slot: Slot) => {
    const file = selected[slot.id];
    if (!file || isSaving) return;
    setBusySlot(slot.id);
    const formData = new FormData();
    formData.set("slot", slot.id);
    formData.set("image", file);
    startSaving(async () => {
      const result = await updateWebsiteImageSlotAction(formData);
      if (result.success && result.imageUrl) {
        setSaved((value) => ({ ...value, [slot.id]: result.imageUrl! }));
        setSelected((value) => ({ ...value, [slot.id]: undefined }));
        const oldPreview = previewUrls.current[slot.id];
        if (oldPreview) URL.revokeObjectURL(oldPreview);
        delete previewUrls.current[slot.id];
        setPreviews((value) => ({ ...value, [slot.id]: undefined }));
        setFeedback((value) => ({ ...value, [slot.id]: { ok: true, text: "تم تحديث الوسائط بنجاح." } }));
      } else {
        setFeedback((value) => ({ ...value, [slot.id]: { ok: false, text: result.error || "تعذر حفظ الملف." } }));
      }
      setBusySlot(null);
    });
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6" aria-labelledby="website-image-slots-title">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-club-primary/10 text-club-primary"><ImagePlus className="h-5 w-5" /></span>
        <div>
          <h2 id="website-image-slots-title" className="text-base font-bold text-foreground">صور أقسام الموقع</h2>
          <p className="mt-1 text-xs text-muted-foreground">بدّل وسائط أقسام الفرق وغلاف فيديو التعريف. تظهر الصورة أو الفيديو في الموقع بعد الحفظ.</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {slots.map((slot) => {
          const media = previews[slot.id] || saved[slot.id] || slot.fallback;
          const video = selected[slot.id]?.type.startsWith("video/") || isVideoUrl(media);
          return (
            <article key={slot.id} className="overflow-hidden rounded-xl border border-border bg-background">
              <div className="relative aspect-video overflow-hidden bg-muted">
                {video ? (
                  <video src={media} className="h-full w-full object-cover" controls playsInline preload="metadata" aria-label={slot.title} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={media} alt={slot.title} className="h-full w-full object-cover" />
                )}
                <span className="absolute end-2 top-2 rounded-md border border-white/15 bg-black/75 px-2 py-1 text-[11px] font-bold text-white">المقاس المناسب: {slot.dimensions}</span>
                {previews[slot.id] && <span className="absolute bottom-2 start-2 rounded-md bg-black/75 px-2 py-1 text-[11px] font-semibold text-white">معاينة قبل الحفظ</span>}
              </div>
              <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0"><h3 className="text-sm font-bold">{slot.title}</h3><p className="mt-0.5 text-[11px] text-muted-foreground">صور JPG وPNG وWebP أو فيديو MP4 وWebM وMOV — حتى {onVercel ? "4" : "8 للصورة و35 للفيديو"} ميغابايت.</p></div>
                <div className="flex shrink-0 items-center gap-2">
                  <label className="cursor-pointer rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">
                    {selected[slot.id] ? "تغيير الملف" : "اختيار صورة أو فيديو"}
                    <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,.mov" className="sr-only" onChange={(event) => pick(slot, event)} disabled={isSaving} />
                  </label>
                  <Button type="button" size="sm" disabled={!selected[slot.id] || isSaving} onClick={() => save(slot)} className="gap-1.5">
                    {busySlot === slot.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    حفظ
                  </Button>
                </div>
              </div>
              {feedback[slot.id] && <p role="status" className={`px-3 pb-3 text-xs font-semibold ${feedback[slot.id]?.ok ? "text-emerald-600" : "text-destructive"}`}>{feedback[slot.id]?.text}</p>}
            </article>
          );
        })}
      </div>
    </section>
  );
}
