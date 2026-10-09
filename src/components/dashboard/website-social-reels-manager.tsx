"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ExternalLink, Film, LoaderCircle, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { identifySocialReel, type SocialReel } from "@/lib/social-reels";
import { toast } from "sonner";

interface Props {
  locale: string;
  reels: SocialReel[];
  action: (formData: FormData) => Promise<{ success: boolean; changed?: boolean; error?: string; reels?: SocialReel[] }>;
  metadataAction: (url: string) => Promise<{ success: boolean; url?: string; title?: string; id?: string; platform?: SocialReel["platform"]; error?: string }>;
}

const platformLabels = { tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook" } as const;
const fallbackReelTitles = new Set(["لحظة من النادي", "لحظة من نادي", "club moment", "moment du club"]);

function isFallbackReelTitle(title: string) {
  return fallbackReelTitles.has(title.trim().replace(/[.!؟?]+$/g, "").toLocaleLowerCase());
}

export function WebsiteSocialReelsManager({ locale, reels: initialReels, action, metadataAction }: Props) {
  const ar = locale === "ar";
  const [reels, setReels] = useState(initialReels);
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [resolvingTitle, setResolvingTitle] = useState(false);
  const [refreshingTitleId, setRefreshingTitleId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const oldTitleRefreshRef = useRef<Promise<{ refreshed: Array<{ id: string; title: string }>; metadataError: string | null }> | null>(null);
  const serialized = useMemo(() => JSON.stringify(reels.map(({ id, url, title }) => ({ id, url, title }))), [reels]);

  useEffect(() => {
    const oldTitles = initialReels.filter((reel) => isFallbackReelTitle(reel.title));
    if (oldTitles.length === 0) return;

    let active = true;
    if (!oldTitleRefreshRef.current) {
      oldTitleRefreshRef.current = (async () => {
        const refreshed: Array<{ id: string; title: string }> = [];
        let metadataError: string | null = null;
        let nextIndex = 0;
        const worker = async () => {
          while (nextIndex < oldTitles.length) {
            const reel = oldTitles[nextIndex++];
            if (!reel) continue;
            try {
              const result = await metadataAction(reel.url);
              const originalVideo = identifySocialReel(reel.url);
              const refreshedVideo = result.url ? identifySocialReel(result.url) : null;
              if (result.success && result.platform === reel.platform && originalVideo?.id === refreshedVideo?.id && result.title && !isFallbackReelTitle(result.title)) {
                refreshed.push({ id: reel.id, title: result.title });
              } else if (result.error) metadataError = result.error;
            } catch (error) {
              // Keep the stored title when the source platform cannot provide metadata.
              if (error instanceof Error) metadataError = error.message;
            }
          }
        };
        await Promise.all(Array.from({ length: Math.min(3, oldTitles.length) }, () => worker()));
        return { refreshed, metadataError };
      })();
    }

    setResolvingTitle(true);
    void oldTitleRefreshRef.current.then(async ({ refreshed, metadataError }) => {
      if (!active) return;
      if (refreshed.length === 0) {
        const error = metadataError || (ar ? "تعذر جلب عناوين الريلز القديمة؛ تأكد أن المنشورات عامة." : "Impossible de récupérer les anciens titres ; vérifiez que les publications sont publiques.");
        setMessage(error);
        toast.error(error);
        return;
      }
      const refreshedTitles = new Map(refreshed.map((item) => [item.id, item.title]));
      const updatedReels = initialReels.map((reel) => {
        const title = refreshedTitles.get(reel.id);
        return title ? { ...reel, title } : reel;
      });
      const formData = new FormData();
      formData.set("reels", JSON.stringify(updatedReels.map(({ id, url, title }) => ({ id, url, title }))));
      try {
        const saved = await action(formData);
        if (!active) return;
        if (!saved.success) throw new Error(saved.error || "save failed");
        setReels(saved.reels ?? updatedReels);
        setDirty(false);
        const success = ar ? "تم جلب عناوين الريلز القديمة وحفظها." : "Titres récupérés et enregistrés.";
        setMessage(success);
        toast.success(success);
      } catch {
        if (!active) return;
        setReels(updatedReels);
        setDirty(true);
        const error = ar ? "جُلبت العناوين لكن تعذر حفظها؛ اضغط حفظ." : "Titres récupérés, mais l’enregistrement a échoué ; cliquez sur Enregistrer.";
        setMessage(error);
        toast.error(error);
      }
    }).finally(() => {
      if (active) setResolvingTitle(false);
    });

    return () => { active = false; };
  }, [initialReels, metadataAction, action, ar]);

  async function addReel() {
    const submittedUrl = url.trim();
    if (!submittedUrl) {
      setMessage(ar ? "أدخل رابط الفيديو أولاً." : "Saisissez d’abord le lien de la vidéo.");
      return;
    }
    if (reels.some((reel) => reel.url === submittedUrl)) {
      setMessage(ar ? "هذا الفيديو مضاف بالفعل." : "Cette vidéo est déjà ajoutée.");
      return;
    }
    if (reels.length >= 24) {
      setMessage(ar ? "يمكن عرض 24 فيديو كحد أقصى." : "Vous pouvez afficher jusqu’à 24 vidéos.");
      return;
    }
    setResolvingTitle(true);
    setMessage(ar ? "جارٍ جلب عنوان الفيديو من المنصة…" : "Récupération du titre depuis la plateforme…");
    try {
      const result = await metadataAction(submittedUrl);
      if (!result.success || !result.url || !result.title || !result.id || !result.platform) {
        const error = result.error ?? (ar ? "تعذر جلب عنوان الفيديو." : "Impossible de récupérer le titre de la vidéo.");
        setMessage(error);
        toast.error(error);
        return;
      }
      if (reels.some((reel) => reel.id === result.id)) {
        const duplicate = ar ? "هذا الفيديو مضاف بالفعل." : "Cette vidéo est déjà ajoutée.";
        setMessage(duplicate);
        toast.info(duplicate);
        return;
      }
      setReels((current) => [{
        id: result.id!,
        url: result.url!,
        title: result.title!,
        platform: result.platform!,
        createdAt: new Date().toISOString()
      }, ...current]);
      setDirty(true);
      setUrl("");
      setMessage(null);
      toast.success(ar ? "تم جلب عنوان الفيديو وإضافته." : "Titre récupéré et vidéo ajoutée.");
    } catch {
      const error = ar ? "تعذر الاتصال بالمنصة لجلب عنوان الفيديو." : "Impossible de contacter la plateforme pour récupérer le titre.";
      setMessage(error);
      toast.error(error);
    } finally {
      setResolvingTitle(false);
    }
  }

  async function refreshReelTitle(reel: SocialReel) {
    setRefreshingTitleId(reel.id);
    try {
      const result = await metadataAction(reel.url);
      const original = identifySocialReel(reel.url);
      const refreshed = result.url ? identifySocialReel(result.url) : null;
      if (!result.success || !result.title || !result.url || !original || !refreshed || original.id !== refreshed.id || refreshed.platform !== reel.platform) {
        throw new Error(result.error ?? (ar ? "تعذر جلب عنوان الريل." : "Impossible de récupérer le titre du Reel."));
      }
      const updatedReels = reels.map((item) => item.id === reel.id ? { ...item, url: result.url!, title: result.title! } : item);
      const formData = new FormData();
      formData.set("reels", JSON.stringify(updatedReels.map(({ id, url, title }) => ({ id, url, title }))));
      const saved = await action(formData);
      if (!saved.success) throw new Error(saved.error ?? (ar ? "تعذر حفظ العنوان." : "Impossible d’enregistrer le titre."));
      setReels(saved.reels ?? updatedReels);
      setDirty(false);
      toast.success(ar ? "تم تحديث عنوان الريل وحفظه." : "Titre du Reel mis à jour et enregistré.");
    } catch (error) {
      const message = error instanceof Error ? error.message : (ar ? "تعذر تحديث العنوان." : "Impossible de mettre à jour le titre.");
      toast.error(message);
      setMessage(message);
    } finally {
      setRefreshingTitleId(null);
    }
  }

  function save(formData: FormData) {
    if (!dirty || pending) {
      toast.info(ar ? "لا توجد تغييرات لحفظها." : "Aucune modification à enregistrer.");
      return;
    }
    startTransition(async () => {
      setMessage(null);
      const result = await action(formData);
      if (!result.success) {
        const error = result.error ?? (ar ? "تعذر الحفظ." : "Échec de l’enregistrement.");
        setMessage(error);
        toast.error(error);
        return;
      }
      if (result.changed === false) {
        toast.info(ar ? "لا توجد تغييرات جديدة." : "Aucune nouvelle modification.");
        setDirty(false);
        return;
      }
      if (result.reels) setReels(result.reels);
      setDirty(false);
      const success = ar ? "تم حفظ فيديوهات الريلز." : "Les vidéos Reels ont été enregistrées.";
      setMessage(success);
      toast.success(success);
    });
  }

  return (
    <form action={save} className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
      <input type="hidden" name="reels" value={serialized} />
      <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-extrabold text-foreground"><Film className="h-5 w-5 text-primary" />{ar ? "ريلز النادي" : "Reels du club"}</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{ar ? "أضف رابط المنشور فقط؛ الفيديو يبقى مستضافاً في منصته ولا يُرفع إلى قاعدة بيانات الموقع." : "Ajoutez uniquement le lien du post ; la vidéo reste hébergée par sa plateforme."}</p>
        </div>
        <button type="submit" disabled={pending || resolvingTitle || !dirty} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-primary px-3 text-xs font-bold text-white disabled:opacity-50"><Save className="h-4 w-4" />{pending ? (ar ? "جارٍ الحفظ…" : "Enregistrement…") : (ar ? "حفظ" : "Enregistrer")}</button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="block min-w-0">
          <span className="mb-1.5 block text-xs font-bold text-muted-foreground">{ar ? "رابط الريل" : "Lien du Reel"}</span>
          <input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://www.tiktok.com/@.../video/..." className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </label>
        <button type="button" onClick={addReel} disabled={resolvingTitle || pending} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-white disabled:cursor-wait disabled:opacity-60">{resolvingTitle ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{resolvingTitle ? (ar ? "جلب العنوان…" : "Récupération…") : (ar ? "إضافة" : "Ajouter")}</button>
      </div>

      {reels.length > 0 ? (
        <ul className="mt-5 divide-y divide-border/60 rounded-xl border border-border/70">
          {reels.map((reel) => (
            <li key={reel.id} className="flex min-w-0 items-center gap-3 p-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Film className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground">{isFallbackReelTitle(reel.title) ? (ar ? "عنوان غير متاح — أعد جلبه" : "Titre indisponible — réessayez") : reel.title}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground"><span>{platformLabels[reel.platform]}</span><span aria-hidden="true">·</span><a href={reel.url} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 hover:text-primary"><span className="truncate">{ar ? "فتح المنشور" : "Ouvrir le post"}</span><ExternalLink className="h-3 w-3 shrink-0" /></a></p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {isFallbackReelTitle(reel.title) && <button type="button" disabled={resolvingTitle || pending || refreshingTitleId !== null} onClick={() => void refreshReelTitle(reel)} aria-label={ar ? "إعادة جلب عنوان الريل" : "Récupérer à nouveau le titre"} title={ar ? "إعادة جلب العنوان" : "Récupérer le titre"} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50">{refreshingTitleId === reel.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</button>}
                <button type="button" onClick={() => { setReels((current) => current.filter((item) => item.id !== reel.id)); setDirty(true); toast.info(ar ? "حُذف من القائمة؛ اضغط حفظ لتأكيد التغيير." : "Retiré de la liste ; enregistrez pour confirmer."); }} aria-label={ar ? `حذف ${reel.title}` : `Supprimer ${reel.title}`} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/20 text-red-500 transition-colors hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">{ar ? "أضف أول فيديو ليظهر في المعرض والرئيسية." : "Ajoutez une première vidéo pour l’afficher dans la galerie et sur l’accueil."}</p>
      )}
      {message && <p role="status" className="mt-4 text-xs font-semibold text-muted-foreground">{message}</p>}
    </form>
  );
}
