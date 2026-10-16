"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Building2,
  Palette,
  MapPin,
  Languages,
  Save,
  Upload,
  CheckCircle2,
  Clock,
  Sparkles,
  Info,
  Calendar,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import { toast } from "sonner";

interface ClubSettingsData {
  id: string;
  name: string;
  shortName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  description: string | null;
  stadium: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  socialLinks: any;
  defaultLocale: string;
  updatedAt: Date | string;
}

interface ClubSettingsFormProps {
  locale: string;
  settings: ClubSettingsData;
  action: (formData: FormData) => Promise<{ id: string } | void>;
}

export function ClubSettingsForm({ locale, settings, action }: ClubSettingsFormProps) {
  const isAr = locale === "ar";
  const [isPending, startTransition] = useTransition();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form interactive preview states
  const [clubName, setClubName] = useState(settings.name || "أمل سيدي حسني");
  const [shortName, setShortName] = useState(settings.shortName || "ESH");
  const [stadium, setStadium] = useState(settings.stadium || (isAr ? "الملعب البلدي طاهري حسني – سيدي حسني" : "Stade communal Taheri Hosni – Sidi Hosni"));
  const [primaryColor, setPrimaryColor] = useState(settings.primaryColor || "#15803d");
  const [secondaryColor, setSecondaryColor] = useState(settings.secondaryColor || "#111827");
  const [logoPreview, setLogoPreview] = useState<string | null>(settings.logoUrl || "/branding/esh-logo-128.png");
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  useEffect(() => () => {
    if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
  }, [logoPreview]);

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFileName(file.name);
      const objectUrl = URL.createObjectURL(file);
      setLogoPreview(objectUrl);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await action(formData);
        const message = isAr
          ? "تم حفظ إعدادات النادي والهوية بنجاح وتحديث النظام والموقع الرسمي."
          : "Paramètres et identité du club enregistrés avec succès.";
        setSuccessMessage(message);
        toast.success(message);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (err: any) {
        setErrorMessage(
          err?.message ||
            (isAr
              ? "حدث خطأ أثناء حفظ الإعدادات. يرجى التحقق من صحة المدخلات."
              : "Une erreur est survenue lors de l'enregistrement.")
        );
      }
    });
  };

  const formattedUpdatedAt = () => {
    try {
      const d = new Date(settings.updatedAt);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      return `${day}/${month}/${year} - ${hours}:${minutes}`;
    } catch {
      return "05/10/2026";
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Feedback Alerts */}
      {successMessage && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-800 dark:text-emerald-300 shadow-xs animate-in fade-in duration-300">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm font-semibold">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive shadow-xs animate-in fade-in duration-300">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-semibold">{errorMessage}</p>
        </div>
      )}

      {/* Institutional Club Hero Card */}
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card/95 to-muted/30 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border/60">
          <div className="flex min-w-0 items-center gap-4">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-2 border-border bg-card p-2 shadow-xs overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoPreview || "/branding/esh-logo-128.png"}
                alt={clubName}
                className="h-full w-full object-contain"
              />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="club-name max-w-full break-words text-2xl font-black tracking-tight text-foreground">{clubName}</h2>
              </div>
              <p className="text-xs text-muted-foreground">
                {isAr
                  ? "أمل سيدي حسني 2018 — ∞ • الاتحاد الجزائري لكرة القدم (FAF) • رابطة تيارت"
                  : "ESPOIR SIDI HOSNI 2018 — ∞ • FAF • Ligue de Tiaret"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="rounded-xl border border-border/70 bg-card px-3.5 py-2 shadow-2xs">
              <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">
                {isAr ? "آخر تحديث للهوية" : "Dernière mise à jour"}
              </span>
              <span className="font-mono font-bold text-foreground">{formattedUpdatedAt()}</span>
            </div>
            <div className="rounded-xl border border-border/70 bg-card px-3.5 py-2 shadow-2xs">
              <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">
                {isAr ? "حالة الرقابة والتتبع" : "Audit & Traçabilité"}
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {isAr ? "مفعّل ونشط" : "Actif"}
              </span>
            </div>
          </div>
        </div>

        {/* Live Identity Banner Simulator */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3 flex items-center gap-3">
            <div
              className="h-8 w-8 rounded-lg shadow-inner border border-white/20 shrink-0"
              style={{ backgroundColor: primaryColor }}
            />
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase text-muted-foreground">
                {isAr ? "اللون الأساسي للنادي" : "Couleur Principale"}
              </div>
              <div className="font-mono font-bold text-foreground truncate">{primaryColor}</div>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/30 p-3 flex items-center gap-3">
            <div
              className="h-8 w-8 rounded-lg shadow-inner border border-white/20 shrink-0"
              style={{ backgroundColor: secondaryColor }}
            />
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase text-muted-foreground">
                {isAr ? "اللون الثانوي للنادي" : "Couleur Secondaire"}
              </div>
              <div className="font-mono font-bold text-foreground truncate">{secondaryColor}</div>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/30 p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-card border border-border flex items-center justify-center shrink-0">
              <MapPin className="h-4 w-4 text-club-primary" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase text-muted-foreground">
                {isAr ? "الملعب المعتمد" : "Stade Officiel"}
              </div>
              <div className="font-bold text-foreground truncate">{stadium}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Section 1: Institutional & Legal Identity */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 border-b border-border/60 pb-3.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-foreground">
                {isAr ? "الهوية المؤسسية والقانونية" : "Identité Institutionnelle"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {isAr ? "اسم النادي المعتمد في المراسلات والوثائق الرسمية والاتحادات" : "Nom officiel pour les correspondances et la FAF"}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isAr ? "اسم النادي الرسمي بالعربية *" : "Nom officiel du club (Arabe) *"}
              </label>
              <input
                type="text"
                name="name"
                required
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                placeholder="أمل سيدي حسني"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isAr ? "الاسم المختصر / باللاتينية *" : "Nom court / Sigle (Latin) *"}
              </label>
              <input
                type="text"
                name="shortName"
                required
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                placeholder="ESPOIR SIDI HOSNI (ESH)"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isAr ? "الملعب المعتمد ومكان الاستقبال" : "Stade municipal officiel"}
              </label>
              <input
                type="text"
                name="stadium"
                value={stadium}
                onChange={(e) => setStadium(e.target.value)}
                placeholder={isAr ? "الملعب البلدي طاهري حسني – سيدي حسني" : "Stade communal Taheri Hosni – Sidi Hosni"}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isAr ? "البيان والتعريف بالنادي" : "Description et vision du club"}
              </label>
              <textarea
                name="description"
                rows={3}
                defaultValue={settings.description ?? ""}
                placeholder={isAr ? "نادي أمل سيدي حسني الرياضي الهاوي، تأسس عام 2018..." : "Club sportif amateur fondé en 2018..."}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Visual Identity, Crest & Colors */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 border-b border-border/60 pb-3.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-foreground">
                {isAr ? "الهوية البصرية والشعار" : "Identité Visuelle & Couleurs"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {isAr ? "الشعار المعتمد والألوان الرسمية المستخدمة في النظام والمنصات" : "Logo officiel et palette de couleurs du club"}
              </p>
            </div>
          </div>

          {/* Logo Upload Box */}
          <div className="rounded-xl border-2 border-dashed border-border/80 bg-muted/20 p-4 transition-all hover:border-primary/50">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-border bg-card shadow-xs overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoPreview || "/branding/esh-logo-128.png"}
                  alt=""
                  className="h-full w-full object-contain p-1"
                />
              </div>
              <div className="flex-1 text-center sm:text-start space-y-1">
                <div className="text-xs font-bold text-foreground">
                  {isAr ? "شعار النادي المعتمد" : "Logo officiel"}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {selectedFileName
                    ? selectedFileName
                    : (isAr ? "PNG, SVG, WEBP أو JPG (يفضل خلفية شفافة)" : "PNG, SVG, WEBP ou JPG (fond transparent conseillé)")}
                </p>
                <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-primary/90 transition-all mt-1">
                  <Upload className="h-3.5 w-3.5" />
                  <span>{isAr ? "رفع شعار جديد" : "Téléverser nouveau logo"}</span>
                  <input
                    type="file"
                    name="logo"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Colors Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isAr ? "اللون الأساسي *" : "Couleur principale *"}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-12 cursor-pointer rounded-lg border border-border bg-background p-1"
                />
                <input
                  type="text"
                  name="primaryColor"
                  required
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="#15803d"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-mono font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isAr ? "اللون الثانوي *" : "Couleur secondaire *"}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="h-10 w-12 cursor-pointer rounded-lg border border-border bg-background p-1"
                />
                <input
                  type="text"
                  name="secondaryColor"
                  required
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  placeholder="#111827"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-mono font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>

          {/* Kit / Brand Card Simulation */}
          <div
            className="rounded-xl p-4 text-white text-center shadow-xs transition-colors"
            style={{
              background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
            }}
          >
            <div className="flex items-center justify-center gap-3">
              <span className="club-name font-black text-sm tracking-wide">{clubName}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-white/20 font-bold backdrop-blur-xs">
                {shortName}
              </span>
            </div>
            <div className="text-[11px] text-white/80 mt-1">
              {isAr ? "معاينة حية لتدرج هوية النادي في الترويسات والبطاقات" : "Aperçu de la signature visuelle"}
            </div>
          </div>
        </div>

        {/* Section 3: Headquarters & Contact Information */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 border-b border-border/60 pb-3.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-foreground">
                {isAr ? "المقر الاجتماعي وبيانات الاتصال" : "Siège Social & Contact"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {isAr ? "العنوان الرسمي، البريد، والهاتف المعتمد للمراسلات الإدارية" : "Coordonnées officielles pour la correspondance administrative"}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isAr ? "المقر والعنوان الاجتماعي" : "Adresse du siège social"}
              </label>
              <input
                type="text"
                name="address"
                defaultValue={settings.address ?? ""}
                placeholder={isAr ? "بلدية سيدي حسني، ولاية تيارت، الجزائر" : "Commune de Sidi Hosni, Wilaya de Tiaret"}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {isAr ? "البريد الإلكتروني الرسمي" : "E-mail officiel"}
                </label>
                <input
                  type="email"
                  name="contactEmail"
                  defaultValue={settings.contactEmail ?? ""}
                  placeholder="contact@esh-club.dz"
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {isAr ? "الهاتف الرسمي / الفاكس" : "Téléphone officiel"}
                </label>
                <input
                  type="text"
                  name="contactPhone"
                  defaultValue={settings.contactPhone ?? ""}
                  placeholder="046 XX XX XX"
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 5: Regional Standards & System Locale */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 border-b border-border/60 pb-3.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Languages className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-foreground">
                {isAr ? "المعايير الإقليمية واللغة" : "Standards Régionaux & Langue"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {isAr ? "اللغة الافتراضية، التوقيت المعتمد، وتنسيق التواريخ الرسمي" : "Langue par défaut et format standard des dates"}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isAr ? "لغة النظام الافتراضية *" : "Langue par défaut du système *"}
              </label>
              <FormSelect
                name="defaultLocale"
                defaultValue={settings.defaultLocale}
                locale={locale}
                ariaLabel={isAr ? "لغة النظام الافتراضية" : "Langue par défaut du système"}
                options={[
                  { value: "ar", label: isAr ? "العربية (الافتراضية)" : "Arabe (Par défaut)" },
                  { value: "fr", label: isAr ? "الفرنسية" : "Français" }
                ]}
                triggerClassName="min-h-11 rounded-xl font-medium"
              />
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{isAr ? "صيغة التاريخ الإلزامية:" : "Format de date officiel:"}</span>
                <span className="font-mono font-bold text-foreground">DD/MM/YYYY</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{isAr ? "النطاق الزمني والتوقيت:" : "Fuseau horaire:"}</span>
                <span className="font-bold text-foreground">{isAr ? "توقيت الجزائر (GMT+1) - 24H" : "Algérie (GMT+1) - 24H"}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/90 bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="h-4 w-4 text-club-primary shrink-0" />
          <span>
            {isAr
              ? "سيتم تطبيق التعديلات فوراً على الموقع العام وجميع وثائق المنصة."
              : "Les modifications s'appliqueront instantanément sur tout le système."}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={isPending}
            className="gap-2 px-6 font-bold shadow-xs transition-all"
          >
            {isPending ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>{isAr ? "جاري الحفظ..." : "Enregistrement en cours..."}</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>{isAr ? "حفظ" : "Enregistrer"}</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
