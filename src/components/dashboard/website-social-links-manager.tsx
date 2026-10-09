"use client";

import { useState, useTransition } from "react";
import { Globe, Save } from "lucide-react";
import { FacebookBrandIcon, InstagramBrandIcon, TikTokBrandIcon } from "@/components/public/social-brand-icons";
import { toast } from "sonner";

interface Props {
  locale: string;
  socialLinks: { facebook?: string; instagram?: string; tiktok?: string } | null;
  action: (formData: FormData) => Promise<{ success: boolean; changed?: boolean; error?: string }>;
}

export function WebsiteSocialLinksManager({ locale, socialLinks, action }: Props) {
  const ar = locale === "ar";
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const fields = [
    { name: "facebookUrl", label: "Facebook", placeholder: "https://facebook.com/espoir.sidihosni", value: socialLinks?.facebook ?? "", Icon: FacebookBrandIcon },
    { name: "instagramUrl", label: "Instagram", placeholder: "https://instagram.com/esh_club_official", value: socialLinks?.instagram ?? "", Icon: InstagramBrandIcon },
    { name: "tiktokUrl", label: "TikTok", placeholder: "https://tiktok.com/@esh_club", value: socialLinks?.tiktok ?? "", Icon: TikTokBrandIcon }
  ];

  return <form action={(data) => {
    if (!dirty || pending) { toast.info(ar ? "لا توجد تغييرات لحفظها." : "Aucune modification à enregistrer."); return; }
    startTransition(async () => {
      setMessage(null);
      try {
        const result = await action(data);
        if (!result.success) { const error = result.error ?? (ar ? "تعذر الحفظ." : "Échec de l’enregistrement."); setMessage(error); toast.error(error); return; }
        setDirty(false);
        if (result.changed === false) { toast.info(ar ? "لا توجد تغييرات جديدة." : "Aucune nouvelle modification."); return; }
        const success = ar ? "تم حفظ روابط الموقع." : "Liens enregistrés.";
        setMessage(success); toast.success(success);
      } catch (error) {
        const message = error instanceof Error ? error.message : (ar ? "تعذر الحفظ." : "Échec de l’enregistrement.");
        setMessage(message); toast.error(message);
      }
    });
  }} className="rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6">
    <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-4">
      <div><h2 className="flex items-center gap-2 text-base font-extrabold text-foreground"><Globe className="h-5 w-5 text-primary" />{ar ? "إدارة مواقع التواصل الاجتماعي" : "Réseaux sociaux du site"}</h2><p className="mt-1 text-xs text-muted-foreground">{ar ? "تظهر الروابط مباشرة في قائمة تابعونا بالموقع العام." : "Les liens apparaissent dans la section Suivez-nous du site public."}</p></div>
      <button type="submit" disabled={pending || !dirty} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-3 text-xs font-bold text-white disabled:opacity-50"><Save className="h-4 w-4" />{pending ? (ar ? "جارٍ الحفظ…" : "Enregistrement…") : (ar ? "حفظ" : "Enregistrer")}</button>
    </div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">{fields.map(({ name, label, placeholder, value, Icon }) => <label key={name} className="block"><span className="mb-1.5 flex items-center gap-2 text-xs font-bold text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{label}</span><input type="url" name={name} defaultValue={value} onChange={() => setDirty(true)} placeholder={placeholder} className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20" /></label>)}</div>
    {message && <p role="status" className="mt-4 text-xs font-semibold text-muted-foreground">{message}</p>}
  </form>;
}
