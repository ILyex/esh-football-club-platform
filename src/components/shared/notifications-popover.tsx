"use client";

import { formatAlgeriaDateTimeLocalized } from "@/lib/dates/algeria";
import { useState, useRef, useEffect, useTransition, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Check, CheckCheck, Clock, ExternalLink } from "lucide-react";
import { markNotificationReadAction, markAllNotificationsReadAction } from "@/app/[locale]/(dashboard)/dashboard/notifications/actions";
import { resolveNotificationLink } from "@/lib/notifications/links";
import { cn } from "@/lib/utils";

export interface PopoverNotificationItem {
  id: string;
  title: string;
  link: string | null;
  createdAt: string | Date;
  isRead: boolean;
  type?: string;
}

export function NotificationsPopover({
  locale,
  unreadCount,
  notifications,
  labels
}: {
  locale: string;
  unreadCount: number;
  notifications: PopoverNotificationItem[];
  labels: {
    title: string;
    markAllRead: string;
    markRead: string;
    viewAll: string;
    empty: string;
  };
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number } | null>(null);
  const [items, setItems] = useState<PopoverNotificationItem[]>(notifications);
  const [unread, setUnread] = useState(unreadCount);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Sync when server props change
  useEffect(() => {
    setItems(notifications);
    setUnread(unreadCount);
  }, [notifications, unreadCount]);

  // Click outside and Esc key listener
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleMarkAllRead = () => {
    const previousItems = items;
    const previousUnread = unread;
    setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
    setUnread(0);
    startTransition(async () => {
      try {
        await markAllNotificationsReadAction();
        router.refresh();
      } catch {
        setItems(previousItems);
        setUnread(previousUnread);
      }
    });
  };

  const handleMarkSingleRead = (id: string) => {
    const target = items.find((item) => item.id === id);
    if (!target || target.isRead) return;
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    setUnread((prev) => Math.max(0, prev - 1));
    startTransition(async () => {
      try {
        await markNotificationReadAction(id);
        router.refresh();
      } catch {
        setItems((prev) => prev.map((item) => item.id === id ? { ...item, isRead: false } : item));
        setUnread((prev) => prev + 1);
      }
    });
  };

  const openPopover = (event: React.MouseEvent<HTMLButtonElement>) => {
    const nextOpen = !isOpen;
    if (nextOpen) {
      const rect = event.currentTarget.getBoundingClientRect();
      const width = Math.min(384, window.innerWidth - 24);
      const desiredLeft = locale === "ar" ? rect.right - width : rect.left;
      const left = Math.max(12, Math.min(desiredLeft, window.innerWidth - width - 12));
      const top = Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 280));
      setPopoverPosition({ top, left });
    }
    setIsOpen(nextOpen);
  };

  const formatTime = (dateInput: string | Date) => {
    try {
      const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
      return formatAlgeriaDateTimeLocalized(d, locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={openPopover}
        aria-expanded={isOpen}
        aria-label={labels.title}
        className={cn(
          "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card p-2 text-muted-foreground shadow-2xs transition-all hover:border-club-primary hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-club-primary/50",
          isOpen && "border-club-primary bg-muted/30 text-foreground"
        )}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-club-primary px-1 text-[10px] font-bold text-white shadow-xs animate-pulse">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          role="region"
          aria-label={labels.title}
          style={popoverPosition ? {
            "--notification-popover-top": `${popoverPosition.top}px`,
            "--notification-popover-left": `${popoverPosition.left}px`
          } as CSSProperties : undefined}
          className={cn(
            "fixed left-[var(--notification-popover-left,0.75rem)] top-[var(--notification-popover-top,5rem)] z-50 w-[min(24rem,calc(100vw-1.5rem))] max-h-[calc(100dvh-var(--notification-popover-top,5rem)-0.75rem)] overflow-y-auto overscroll-contain rounded-2xl border border-border/80 bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/80 bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground">{labels.title}</span>
              {unread > 0 && (
                <span className="rounded-full bg-club-primary/10 px-2 py-0.5 text-[11px] font-bold text-club-primary">
                  {unread}
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={isPending}
                className="flex min-h-10 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-club-primary transition-colors hover:bg-muted/70 hover:underline"
              >
                <CheckCheck className="h-3 w-3" />
                <span>{labels.markAllRead}</span>
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-[min(20rem,calc(100dvh-13rem))] overflow-y-auto overscroll-contain divide-y divide-border/60 scrollbar-thin">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted/60 text-muted-foreground/70">
                  <Bell className="h-5 w-5" />
                </div>
                <p className="text-xs text-muted-foreground">{labels.empty}</p>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "group relative flex items-start gap-3 p-3 text-xs transition-colors hover:bg-muted/40",
                    !item.isRead && "bg-muted/20"
                  )}
                >
                  {/* Unread indicator */}
                  <span
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full transition-colors",
                      !item.isRead ? "bg-club-primary shadow-2xs" : "bg-muted-foreground/20"
                    )}
                  />

                  {/* Notification Content */}
                  <div className="min-w-0 flex-1">
                    <Link
                      href={item.link ? resolveNotificationLink(item.link, locale) : `/${locale}/dashboard/notifications`}
                      onClick={() => {
                        setIsOpen(false);
                        handleMarkSingleRead(item.id);
                      }}
                      className="block hover:underline"
                    >
                      <p className={cn("text-xs leading-snug", !item.isRead ? "font-bold text-foreground" : "text-muted-foreground")}>
                        {item.title}
                      </p>
                    </Link>
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{formatTime(item.createdAt)}</span>
                    </div>
                  </div>

                  {/* Quick Mark Read Action */}
                  {!item.isRead && (
                    <button
                      type="button"
                      onClick={() => handleMarkSingleRead(item.id)}
                      title={labels.markRead}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground shadow-2xs transition-colors hover:bg-background hover:text-club-primary"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer Link */}
          <div className="border-t border-border bg-muted/20 p-2.5 text-center">
            <Link
              href={`/${locale}/dashboard/notifications`}
              onClick={() => setIsOpen(false)}
              className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg px-3 text-xs font-semibold text-club-primary transition-colors hover:bg-muted/70 hover:underline"
            >
              <span>{labels.viewAll}</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
