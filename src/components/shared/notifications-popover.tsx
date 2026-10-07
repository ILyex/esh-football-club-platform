"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import Link from "next/link";
import { Bell, Check, CheckCheck, Clock, ExternalLink } from "lucide-react";
import { markNotificationReadAction, markAllNotificationsReadAction } from "@/app/[locale]/(dashboard)/dashboard/notifications/actions";
import { cn } from "@/lib/utils";

export interface PopoverNotificationItem {
  id: string;
  title: string;
  link: string | null;
  createdAt: string | Date;
  isRead: boolean;
  type?: string;
}

function resolveNotificationLink(rawLink?: string | null): string {
  if (!rawLink) return "/dashboard";
  let cleaned = rawLink.replace(/^\/dashboard\/dashboard/, "/dashboard");
  if (!cleaned.startsWith("/")) cleaned = `/${cleaned}`;
  if (!cleaned.startsWith("/dashboard")) cleaned = `/dashboard${cleaned}`;
  if (cleaned.startsWith("/dashboard/contracts/")) {
    cleaned = "/dashboard/contracts";
  }
  if (cleaned.startsWith("/dashboard/documents/")) {
    cleaned = "/dashboard/documents";
  }
  return cleaned;
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
  const [items, setItems] = useState<PopoverNotificationItem[]>(notifications);
  const [unread, setUnread] = useState(unreadCount);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

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
    setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
    setUnread(0);
    startTransition(async () => {
      await markAllNotificationsReadAction();
    });
  };

  const handleMarkSingleRead = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    setUnread((prev) => Math.max(0, prev - 1));
    startTransition(async () => {
      await markNotificationReadAction(id);
    });
  };

  const formatTime = (dateInput: string | Date) => {
    try {
      const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
      return new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-FR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(d);
    } catch {
      return "";
    }
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label={labels.title}
        className={cn(
          "relative rounded-xl border border-border bg-card p-2 text-muted-foreground transition-all shadow-2xs hover:border-club-primary hover:text-foreground focus-visible:outline-hidden",
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
          className="absolute end-0 top-full mt-2 w-80 sm:w-96 rounded-2xl border border-border/80 bg-card shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
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
                className="flex items-center gap-1 text-[11px] font-semibold text-club-primary hover:underline transition-colors"
              >
                <CheckCheck className="h-3 w-3" />
                <span>{labels.markAllRead}</span>
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-border/60 scrollbar-thin">
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
                    {item.link ? (
                      <Link
                        href={`/${locale}${resolveNotificationLink(item.link)}`}
                        onClick={() => setIsOpen(false)}
                        className="block hover:underline"
                      >
                        <p className={cn("text-xs leading-snug", !item.isRead ? "font-bold text-foreground" : "text-muted-foreground")}>
                          {item.title}
                        </p>
                      </Link>
                    ) : (
                      <p className={cn("text-xs leading-snug", !item.isRead ? "font-bold text-foreground" : "text-muted-foreground")}>
                        {item.title}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{formatTime(item.createdAt)}</span>
                    </div>
                  </div>

                  {/* Quick Mark Read Action */}
                  {!item.isRead && (
                    <button
                      type="button"
                      onClick={(e) => handleMarkSingleRead(item.id, e)}
                      title={labels.markRead}
                      className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-background hover:text-club-primary shadow-2xs transition-colors"
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
              className="inline-flex items-center gap-1 text-xs font-semibold text-club-primary hover:underline transition-colors"
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
