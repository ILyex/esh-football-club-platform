"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Award, Calendar, CalendarDays, HeartHandshake, Landmark, Mail, MapPin, Phone, Shield, Sparkles, Trophy, Users } from "lucide-react";

interface ClubOverviewPageProps {
  locale: string;
  phone: string | null;
  email: string | null;
}

const milestones = [
  { year: "2018", icon: Calendar, ar: ["التأسيس", "انطلقت الجمعية الرياضية أمل سيدي حسني لكرة القدم من بلدية سيدي حسني بولاية تيارت، حاملةً طموح بناء نادٍ يخدم أبناء المنطقة."], fr: ["La fondation", "L’Association Sportive Espoir Sidi Hosni est née à Sidi Hosni, dans la wilaya de Tiaret, avec l’ambition de servir les jeunes de la région."] },
  { year: "01", icon: Users, ar: ["بناء القاعدة", "تكوين قاعدة لاعبين واكتشاف المواهب المحلية ضمن بيئة تجمع الانضباط، التعلّم وروح الفريق."], fr: ["Construire la base", "Former un vivier de joueurs et révéler les talents locaux dans un environnement fondé sur la discipline et l’esprit d’équipe."] },
  { year: "02", icon: Trophy, ar: ["المنافسة", "الانتقال من التدريب إلى المنافسة الرسمية عبر فئات النادي، مع متابعة تطور اللاعب داخل الملعب وخارجه."], fr: ["La compétition", "Passer de la formation à la compétition officielle à travers les catégories du club, en accompagnant chaque joueur sur et hors du terrain."] },
  { year: "∞", icon: Sparkles, ar: ["المستقبل", "مسار مستمر نحو تكوين أفضل، حضور أقوى، ومجتمع رياضي يضع أبناء سيدي حسني في قلب المشروع."], fr: ["La suite", "Un parcours continu vers une meilleure formation, une présence plus forte et un projet sportif au cœur de la communauté de Sidi Hosni."] }
] as const;

export function ClubOverviewPage({ locale, phone, email }: ClubOverviewPageProps) {
  const ar = locale === "ar";
  const [active, setActive] = useState(0);
  const [activePrinciple, setActivePrinciple] = useState(0);
  const item = milestones[active] ?? milestones[0]!;
  const Icon = item.icon;
  const Arrow = ar ? ArrowLeft : ArrowRight;

  const principles = ar
    ? [[Shield, "هوية محلية", "نادي أبناء المنطقة وذاكرتها الرياضية."], [Users, "تكوين مستمر", "الفئات السنية هي أساس مشروعنا."], [HeartHandshake, "روح الفريق", "الانضباط والاحترام والعمل الجماعي."]]
    : [[Shield, "Identité locale", "Un club ancré dans la mémoire de la région."], [Users, "Formation continue", "Les catégories jeunes sont notre base."], [HeartHandshake, "Esprit d’équipe", "Discipline, respect et travail collectif."]];

  return (
    <main className="bg-background">
      <section className="relative overflow-hidden border-b border-border bg-[#0c0d0e] px-4 py-14 text-white sm:py-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.24),transparent_62%)]" />
        <div className="relative mx-auto max-w-6xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-300"><Landmark className="h-4 w-4" />{ar ? "عن الجمعية" : "À propos du club"}</span>
          <h1 className="club-name mt-5 text-3xl font-black tracking-tight sm:text-5xl">{ar ? "الجمعية الرياضية أمل سيدي حسني لكرة القدم" : "Association Sportive Espoir Sidi Hosni de Football"}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-zinc-300 sm:text-base">{ar ? "مسار رياضي محلي، يبدأ من التكوين ويكبر بالطموح والانتماء." : "Un projet sportif local qui grandit par la formation, l’ambition et l’appartenance."}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-2 text-xs font-bold text-zinc-300"><span className="rounded-lg bg-white/10 px-3 py-2">ESH • 2018 — ∞</span><span className="rounded-lg bg-white/10 px-3 py-2">{ar ? "سيدي حسني، تيارت" : "Sidi Hosni, Tiaret"}</span></div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:py-12">
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-border bg-card p-5 sm:p-8">
            <h2 className="flex items-center gap-2 text-xl font-black text-foreground sm:text-2xl"><Shield className="h-5 w-5 text-club-primary" />{ar ? "من نحن؟" : "Qui sommes-nous ?"}</h2>
            <p className="mt-5 text-sm leading-8 text-muted-foreground sm:text-base">{ar ? "الجمعية الرياضية أمل سيدي حسني لكرة القدم هي فضاء رياضي وتربوي يضع اللاعب في قلب المشروع. نعمل على توفير بيئة آمنة ومنظمة تساعد أبناء سيدي حسني على اكتشاف قدراتهم، تعلّم قيم الرياضة، وتمثيل منطقتهم بفخر." : "L’Association Sportive Espoir Sidi Hosni est un espace sportif et éducatif qui place le joueur au cœur du projet. Nous créons un cadre organisé où les jeunes découvrent leurs capacités, apprennent les valeurs du sport et représentent leur région avec fierté."}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">{principles.map(([PIcon, title, text], index) => { const P = PIcon as typeof Shield; return <button key={title as string} type="button" onClick={() => setActivePrinciple(index)} className={`rounded-2xl border p-3 text-start transition-all ${activePrinciple === index ? "border-club-primary/50 bg-club-primary/10 shadow-sm" : "border-border/80 bg-background/70 hover:border-club-primary/30"}`}><P className={`h-5 w-5 ${activePrinciple === index ? "text-club-primary" : "text-muted-foreground"}`} /><h3 className="mt-3 text-xs font-black text-foreground">{title as string}</h3><p className="mt-1 text-[11px] leading-5 text-muted-foreground">{text as string}</p></button>; })}</div>
          </div>
          <div className="rounded-3xl border border-border bg-card p-5 sm:p-8">
            <h2 className="text-xl font-black text-foreground sm:text-2xl">{ar ? "معلومات الجمعية" : "Informations"}</h2>
            <dl className="mt-5 divide-y divide-border/70 text-sm">
              <div className="flex items-start justify-between gap-4 py-3"><dt className="inline-flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4 shrink-0 text-club-primary" aria-hidden="true" />{ar ? "المقر" : "Siège"}</dt><dd className="max-w-[65%] text-end font-bold text-foreground">{ar ? "الملعب البلدي طاهري حسني – سيدي حسني" : "Stade communal Taheri Hosni – Sidi Hosni"}</dd></div>
              <div className="flex items-center justify-between gap-4 py-3"><dt className="inline-flex items-center gap-2 text-muted-foreground"><CalendarDays className="h-4 w-4 shrink-0 text-club-primary" aria-hidden="true" />{ar ? "سنة التأسيس" : "Fondation"}</dt><dd className="font-mono font-bold text-club-primary">2018</dd></div>
              {phone && <div className="flex items-center justify-between gap-4 py-3"><dt className="inline-flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4 shrink-0 text-club-primary" aria-hidden="true" />{ar ? "الهاتف" : "Téléphone"}</dt><dd dir="ltr" className="font-bold text-foreground">{phone}</dd></div>}
              {email && <div className="flex items-center justify-between gap-4 py-3"><dt className="inline-flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4 shrink-0 text-club-primary" aria-hidden="true" />{ar ? "البريد" : "E-mail"}</dt><dd className="max-w-[65%] break-all text-end font-bold text-foreground">{email}</dd></div>}
            </dl>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-5 sm:p-8" aria-labelledby="club-timeline-title">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><span className="text-xs font-bold text-club-primary">{ar ? "المسار" : "Le parcours"}</span><h2 id="club-timeline-title" className="mt-1 text-2xl font-black text-foreground">{ar ? "من التأسيس إلى المستقبل" : "De la fondation à la suite"}</h2></div><span className="text-xs text-muted-foreground">{ar ? "اضغط على أي محطة لاكتشافها" : "Sélectionnez une étape"}</span></div>
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-center">
            <div className="relative grid grid-cols-4 gap-2 sm:gap-5">{milestones.map((m, index) => { const MIcon = m.icon; return <button key={m.year} type="button" onClick={() => setActive(index)} aria-pressed={active === index} className={`group relative flex flex-col items-center gap-2 text-center ${active === index ? "text-club-primary" : "text-muted-foreground"}`}><span className={`z-10 flex h-12 w-12 items-center justify-center rounded-2xl border-2 bg-card transition-all ${active === index ? "border-club-primary shadow-lg shadow-club-primary/20" : "border-border group-hover:border-club-primary/50"}`}><MIcon className="h-5 w-5" /></span><span dir="ltr" className="font-mono text-xs font-black">{m.year}</span><span className="text-[10px] font-bold leading-4">{ar ? m.ar[0] : m.fr[0]}</span></button>; })}<div className="absolute inset-x-8 top-6 -z-0 h-px bg-border sm:inset-x-12" /></div>
            <div className="rounded-2xl border border-club-primary/20 bg-club-primary/[0.04] p-5"><div className="flex items-center justify-between"><span className="text-sm font-black text-foreground">{ar ? item.ar[0] : item.fr[0]}</span><span dir="ltr" className="font-mono text-sm font-black text-club-primary">{item.year}</span></div><p className="mt-4 text-sm leading-7 text-muted-foreground">{ar ? item.ar[1] : item.fr[1]}</p><button type="button" onClick={() => setActive((active + 1) % milestones.length)} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-club-primary px-3 text-xs font-bold text-white hover:bg-club-primary-hover">{ar ? "المحطة التالية" : "Étape suivante"}<Arrow className="h-3.5 w-3.5" /></button></div>
          </div>
        </section>
        <section className="rounded-3xl border border-club-primary/20 bg-club-primary/[0.06] p-5 text-center sm:p-8"><Award className="mx-auto h-7 w-7 text-club-primary" /><h2 className="mt-3 text-xl font-black text-foreground">{ar ? "نحو مستقبل أكبر" : "Vers un avenir plus grand"}</h2><p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">{ar ? "كل حصة تدريب، كل مباراة، وكل لاعب جديد هو جزء من قصة الجمعية. انضموا إلى المسار وتابعوا آخر أخبار الفريق." : "Chaque entraînement, chaque match et chaque nouveau joueur écrit une page de notre histoire. Suivez le club et son actualité."}</p></section>
      </div>
    </main>
  );
}
