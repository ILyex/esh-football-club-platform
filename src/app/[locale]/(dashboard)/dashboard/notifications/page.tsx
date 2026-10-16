import { formatAlgeriaDateTimeLocalized } from "@/lib/dates/algeria";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { getSessionOrThrow } from "@/lib/permissions";
import { markNotificationReadAction } from "./actions";
import { MarkAllReadButton } from "./mark-all-read-button";
import { DeleteAllNotificationsButton } from "./delete-all-notifications-button";
import { NOTIFIABLE_TYPE_KEYS } from "@/lib/insights/notifications";
import { resolveNotificationLink } from "@/lib/notifications/links";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bell,
  CheckCheck,
  Calendar,
  DollarSign,
  FileText,
  UserCheck,
  Activity,
  Layers,
  ArrowRight,
  ArrowUpRight,
  Clock,
  Sparkles
} from "lucide-react";

export default async function NotificationsPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ filter?: string; category?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await getSessionOrThrow();
  const t = await getTranslations("notifications");
  const tCommon = await getTranslations("common");
  const tInsights = await getTranslations("insights");

  const activeStatusFilter = sp.filter ?? "all";
  const activeCategory = sp.category ?? "all";
  const activeFilterClass = "bg-club-primary text-white shadow-xs";
  const inactiveFilterClass =
    "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground";
  const activeCountClass = "bg-black/20 text-white";
  const inactiveCountClass = "bg-background/70 text-muted-foreground";

  const allNotifications = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  const totalCount = allNotifications.length;
  const unreadCount = allNotifications.filter((n) => !n.isRead).length;

  // Filter in memory for instantaneous sub-filter switching
  const filteredNotifications = allNotifications.filter((n) => {
    // 1. Status filter
    if (activeStatusFilter === "unread" && n.isRead) return false;
    if (activeStatusFilter === "read" && !n.isRead) return false;

    const link = n.link || "";

    // 2. Category filter
    if (activeCategory === "matches") {
      return (
        n.type.includes("MATCH") ||
        link.includes("/matches") ||
        link.includes("/calendar")
      );
    }
    if (activeCategory === "contracts") {
      return (
        n.type.includes("CONTRACT") ||
        n.type.includes("PLAYER") ||
        link.includes("/contracts") ||
        link.includes("/players")
      );
    }
    if (activeCategory === "finance") {
      return (
        n.type.includes("BUDGET") ||
        n.type.includes("EXPENSE") ||
        n.type.includes("TREASURY") ||
        link.includes("/finance")
      );
    }
    if (activeCategory === "training") {
      return (
        n.type.includes("TRAINING") ||
        n.type.includes("INVENTORY") ||
        link.includes("/training") ||
        link.includes("/inventory")
      );
    }
    if (activeCategory === "system") {
      return (
        n.type.includes("DOCUMENT") ||
        link.includes("/documents") ||
        link.includes("/settings") ||
        link.includes("/users")
      );
    }

    return true;
  });

  const getCategoryMeta = (type: string, rawLink: string | null) => {
    const link = rawLink || "";
    if (type.includes("MATCH") || link.includes("/matches")) {
      return {
        icon: Calendar,
        color: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/20",
        label: locale === "ar" ? "مباراة / منافسة" : "Match"
      };
    }
    if (type.includes("CONTRACT") || type.includes("PLAYER") || link.includes("/contracts") || link.includes("/players")) {
      return {
        icon: UserCheck,
        color: "text-blue-600 dark:text-blue-400",
        bg: "bg-blue-500/10",
        border: "border-blue-500/20",
        label: locale === "ar" ? "عقد / لاعب" : "Contrat / Joueur"
      };
    }
    if (type.includes("BUDGET") || type.includes("EXPENSE") || link.includes("/finance")) {
      return {
        icon: DollarSign,
        color: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-500/10",
        border: "border-amber-500/20",
        label: locale === "ar" ? "مالية النادي" : "Finances"
      };
    }
    if (type.includes("TRAINING") || link.includes("/training") || link.includes("/inventory")) {
      return {
        icon: Activity,
        color: "text-purple-600 dark:text-purple-400",
        bg: "bg-purple-500/10",
        border: "border-purple-500/20",
        label: locale === "ar" ? "تدريب / عتاد" : "Entraînement"
      };
    }
    return {
      icon: FileText,
      color: "text-cyan-600 dark:text-cyan-400",
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/20",
      label: locale === "ar" ? "وثيقة / إدارة" : "Document / Système"
    };
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ----------------- Header Banner ----------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 sm:p-6 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-club-primary/10 text-club-primary">
            <Bell className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                {t("title")}
              </h1>
              {unreadCount > 0 ? (
                <Badge tone="danger" className="text-xs font-semibold px-2">
                  {unreadCount} {t("unread")}
                </Badge>
              ) : (
                <Badge tone="success" className="text-xs font-semibold px-2">
                  {locale === "ar" ? "محدثة كلياً" : "À jour"}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {locale === "ar"
                ? "متابعة التنبيهات الإدارية، مواعيد المباريات، فواتير المصاريف، وتجديد العقود"
                : "Suivi des alertes administratives, des matchs, des dépenses et des contrats"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {unreadCount > 0 && (
            <MarkAllReadButton
              label={t("markAllRead")}
              errorLabel={locale === "ar" ? "تعذر تحديث الإشعارات. حاول مرة أخرى." : "Impossible de mettre à jour les notifications. Réessayez."}
            />
          )}
          {totalCount > 0 && <DeleteAllNotificationsButton locale={locale} />}
        </div>
      </div>

      {/* ----------------- Status Filter Pills ----------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/${locale}/dashboard/notifications?${new URLSearchParams({
              ...(activeCategory !== "all" ? { category: activeCategory } : {}),
              filter: "all"
            })}`}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeStatusFilter === "all"
                ? activeFilterClass
                : inactiveFilterClass
            }`}
          >
            <span>{t("all")}</span>
            <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${activeStatusFilter === "all" ? activeCountClass : inactiveCountClass}`}>
              {totalCount}
            </span>
          </Link>

          <Link
            href={`/${locale}/dashboard/notifications?${new URLSearchParams({
              ...(activeCategory !== "all" ? { category: activeCategory } : {}),
              filter: "unread"
            })}`}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeStatusFilter === "unread"
                ? activeFilterClass
                : inactiveFilterClass
            }`}
          >
            <span>{t("unread")}</span>
            {unreadCount > 0 && (
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${activeStatusFilter === "unread" ? activeCountClass : inactiveCountClass}`}>
                {unreadCount}
              </span>
            )}
          </Link>

          <Link
            href={`/${locale}/dashboard/notifications?${new URLSearchParams({
              ...(activeCategory !== "all" ? { category: activeCategory } : {}),
              filter: "read"
            })}`}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeStatusFilter === "read"
                ? activeFilterClass
                : inactiveFilterClass
            }`}
          >
            <span>{locale === "ar" ? "المقروءة" : "Lues"}</span>
            <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${activeStatusFilter === "read" ? activeCountClass : inactiveCountClass}`}>
              {totalCount - unreadCount}
            </span>
          </Link>
        </div>

        {/* Category Dropdown Filter */}
        <div className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="flex flex-wrap items-center gap-1">
            {[
              { id: "all", label: t("categories.all") },
              { id: "matches", label: t("categories.matches") },
              { id: "finance", label: t("categories.finance") },
              { id: "contracts", label: t("categories.contracts") },
              { id: "training", label: t("categories.training") },
              { id: "system", label: t("categories.system") }
            ].map((cat) => (
              <Link
                key={cat.id}
                href={`/${locale}/dashboard/notifications?${new URLSearchParams({
                  ...(activeStatusFilter !== "all" ? { filter: activeStatusFilter } : {}),
                  category: cat.id
                })}`}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  activeCategory === cat.id
                    ? activeFilterClass
                    : inactiveFilterClass
                }`}
              >
                {cat.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ----------------- Notifications Feed ----------------- */}
      <div className="space-y-2.5">
        {filteredNotifications.map((n) => {
          async function markRead() {
            "use server";
            await markNotificationReadAction(n.id);
          }

          const insightKey = ((n.params as any)?._t as string | undefined) ?? n.type;
          const localizedTitle =
            n.params && NOTIFIABLE_TYPE_KEYS.includes(insightKey)
              ? tInsights(`types.${insightKey}` as any, n.params as any)
              : n.title;

          const meta = getCategoryMeta(n.type, n.link);
          const IconComponent = meta.icon;

          return (
            <div
              key={n.id}
              className={`group relative flex items-start justify-between gap-3 rounded-xl border p-3.5 sm:p-4 transition-all duration-200 ${
                !n.isRead
                  ? "border-border/70 border-s-2 border-s-club-primary bg-card hover:border-border shadow-xs"
                  : "border-border/60 bg-card/60 hover:bg-card hover:border-border"
              }`}
            >
              {/* Category Icon Badge */}
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${meta.bg} ${meta.color} ${meta.border}`}
              >
                <IconComponent className="h-5 w-5" />
              </div>

              {/* Main Content Link */}
              <Link href={resolveNotificationLink(n.link, locale)} className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span
                    className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${meta.bg} ${meta.color}`}
                  >
                    {meta.label}
                  </span>
                  {!n.isRead && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.2 text-[10px] font-bold text-red-600 dark:text-red-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                      {locale === "ar" ? "جديد" : "Nouveau"}
                    </span>
                  )}
                </div>

                <p
                  className={`text-sm leading-snug ${
                    !n.isRead ? "font-bold text-foreground" : "font-normal text-muted-foreground"
                  }`}
                >
                  {localizedTitle}
                </p>

                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatAlgeriaDateTimeLocalized(n.createdAt, locale, { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                  <span
                    className="inline-flex items-center justify-center h-5 w-5 rounded-md bg-muted/60 text-muted-foreground group-hover:bg-club-primary/10 group-hover:text-club-primary transition-colors"
                    title={locale === "ar" ? "الانتقال إلى التفاصيل" : "Consulter"}
                  >
                    <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
                  </span>
                </div>
              </Link>

              {/* Mark as Read Action Button */}
              {!n.isRead && (
                <div className="shrink-0 pt-1">
                  <form action={markRead}>
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5 text-xs text-muted-foreground hover:text-club-primary hover:bg-club-primary/10"
                      title={t("markRead")}
                    >
                      <CheckCheck className="h-3.5 w-3.5 mr-1 rtl:ml-1" />
                      <span>{t("markRead")}</span>
                    </Button>
                  </form>
                </div>
              )}
            </div>
          );
        })}

        {filteredNotifications.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/60 text-muted-foreground mb-3">
              <Bell className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-foreground">
              {activeStatusFilter === "unread" ? t("emptyUnread") : t("empty")}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              {locale === "ar"
                ? "سيتم إشعارك تلقائياً عند تسجيل أي مواعيد مباريات، مستحقات مصاريف، أو تنبيهات إدارية جديدة."
                : "Vous recevrez des alertes en temps réel lors de nouveaux matchs, dépenses ou convocations."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
