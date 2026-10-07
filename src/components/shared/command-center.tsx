"use client";

import { useState, useEffect, useRef, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Search,
  Command,
  ArrowRight,
  ArrowLeft,
  X,
  History as HistoryIcon,
  AlertTriangle,
  AlertCircle,
  Bell,
  Sparkles,
  Layers,
  Compass,
  FileText,
  Users,
  Calendar,
  CheckCircle2,
  DollarSign
} from "lucide-react";
import type { CommandItem } from "@/lib/commands/command-registry";
import type { AttentionItem } from "@/lib/commands/attention-service";
import type { SearchResponse, SearchCategoryGroup, SearchResultItem } from "@/lib/search/search-service";

export function openCommandCenter() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("open-command-center"));
  }
}

export function CommandCenterTrigger({
  locale,
  className
}: {
  locale: string;
  className?: string;
}) {
  const t = useTranslations("command");
  const tSearch = useTranslations("search");
  const router = useRouter();
  const isArabic = locale === "ar";
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<SearchCategoryGroup[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyKey = `dashboard-search-history:${locale}`;

  useEffect(() => {
    const focusDashboardSearch = () => inputRef.current?.focus();
    window.addEventListener("focus-dashboard-search", focusDashboardSearch);
    return () => window.removeEventListener("focus-dashboard-search", focusDashboardSearch);
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(historyKey) || "[]");
      if (Array.isArray(saved)) setHistory(saved.filter((item): item is string => typeof item === "string").slice(0, 6));
    } catch {
      setHistory([]);
    }
  }, [historyKey]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setGroups([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&locale=${locale}`);
        if (!response.ok) throw new Error("Search failed");
        const data: SearchResponse = await response.json();
        setGroups(data.groups || []);
      } catch {
        setGroups([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, locale]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const saveSearch = (term: string) => {
    const next = [term.trim(), ...history.filter((item) => item !== term.trim())].slice(0, 6);
    setHistory(next);
    try {
      window.localStorage.setItem(historyKey, JSON.stringify(next));
    } catch {
      // Search remains available if browser storage is disabled.
    }
  };

  const goToSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    saveSearch(trimmed);
    setOpen(false);
    router.push(`/${locale}/dashboard/search?q=${encodeURIComponent(trimmed)}`);
  };

  const results = groups.flatMap((group) => group.items.map((item) => ({
    ...item,
    categoryLabel: tSearch(`categories.${group.key}` as any)
  }))).slice(0, 6);

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className={`flex items-center gap-2 rounded-md border border-border bg-background/80 px-3 py-1.5 text-xs transition focus-within:border-club-primary focus-within:ring-2 focus-within:ring-club-primary/15 ${className ?? ""}`}>
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onFocus={() => { if (query.trim().length >= 2) setOpen(true); }}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            setOpen(nextQuery.trim().length >= 2);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              goToSearch(query);
            }
            if (event.key === "Escape") setOpen(false);
          }}
          placeholder={t("placeholder")}
          aria-label={t("placeholder")}
          aria-expanded={open}
          aria-controls="dashboard-search-suggestions"
          className="min-w-0 flex-1 bg-transparent text-xs font-medium text-foreground outline-none placeholder:text-muted-foreground"
        />
        {query ? (
          <button type="button" onClick={() => { setQuery(""); setOpen(false); }} aria-label={t("close")} className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        ) : history.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-label={isArabic ? "عمليات البحث السابقة" : "Recherches récentes"}
            aria-expanded={open}
            aria-controls="dashboard-search-suggestions"
            className={`shrink-0 rounded-lg p-1.5 transition hover:bg-muted ${open ? "text-club-primary" : "text-muted-foreground hover:text-foreground"}`}
            title={isArabic ? "عمليات البحث السابقة" : "Recherches récentes"}
          >
            <HistoryIcon className="h-4 w-4" />
          </button>
        ) : (
          <kbd className="hidden shrink-0 rounded-md border border-border bg-muted/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
            {t("shortcut")}
          </kbd>
        )}
      </div>

      {open && (query.trim().length >= 2 || (query.length === 0 && history.length > 0)) && (
        <div id="dashboard-search-suggestions" className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xl ring-1 ring-black/5">
          {query.trim().length < 2 ? (
            <>
              <div className="flex items-center justify-between border-b border-border/70 bg-muted/30 px-3.5 py-2.5">
                <span className="flex items-center gap-2 text-xs font-bold text-foreground"><HistoryIcon className="h-3.5 w-3.5 text-club-primary" />{isArabic ? "عمليات البحث الأخيرة" : "Recherches récentes"}</span>
                <button
                  type="button"
                  onClick={() => {
                    setHistory([]);
                    try { window.localStorage.removeItem(historyKey); } catch { /* ignore */ }
                  }}
                  className="rounded-md px-2 py-1 text-[11px] font-semibold text-muted-foreground transition hover:bg-background hover:text-club-primary"
                >
                  {isArabic ? "مسح" : "Effacer"}
                </button>
              </div>
              <div className="max-h-64 space-y-1 overflow-y-auto p-2">
                {history.map((term) => (
                  <button key={term} type="button" onClick={() => goToSearch(term)} className="group flex w-full items-center gap-2.5 rounded-xl border border-transparent px-2.5 py-2.5 text-start text-xs text-foreground transition hover:border-border/70 hover:bg-muted/70">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition group-hover:bg-background group-hover:text-club-primary"><Search className="h-3.5 w-3.5" /></span>
                    <span className="min-w-0 flex-1 truncate">{term}</span>
                    {isArabic ? <ArrowLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                  </button>
                ))}
              </div>
            </>
          ) : loading ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">{tSearch("loading")}</div>
          ) : results.length > 0 ? (
            <div className="max-h-72 space-y-0.5 overflow-y-auto p-1.5">
              {results.map((item) => (
                <button key={`${item.categoryLabel}-${item.id}`} type="button" onClick={() => goToSearch(query)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start transition hover:bg-muted">
                  <Layers className="h-3.5 w-3.5 shrink-0 text-club-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-foreground">{item.title}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">{item.categoryLabel}{item.subtitle ? ` · ${item.subtitle}` : ""}</span>
                  </span>
                  {isArabic ? <ArrowLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                </button>
              ))}
              <button type="button" onClick={() => goToSearch(query)} className="mt-1 flex w-full items-center justify-center gap-1.5 border-t border-border/70 px-2 py-2 text-[11px] font-bold text-club-primary hover:bg-muted/60">
                {t("searchAll")}
                {isArabic ? <ArrowLeft className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
              </button>
            </div>
          ) : (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">{tSearch("noResults")}</div>
          )}
        </div>
      )}
    </div>
  );
}

type SelectableItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  href: string;
  groupKey: "attention" | "actions" | "navigation" | "records";
  groupLabel: string;
  badge?: string | null;
  severity?: "info" | "warning" | "danger";
};

export function CommandCenter({ locale }: { locale: string }) {
  const t = useTranslations("command");
  const tSearch = useTranslations("search");
  const router = useRouter();
  const isArabic = locale === "ar";
  const [isPending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [commands, setCommands] = useState<{
    navigation: CommandItem[];
    actions: CommandItem[];
    attention: AttentionItem[];
  }>({ navigation: [], actions: [], attention: [] });
  const [searchResults, setSearchResults] = useState<SearchCategoryGroup[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Global listeners for open/close and keyboard shortcuts
  useEffect(() => {
    const handleOpen = () => setOpen(true);
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(false);
        window.dispatchEvent(new CustomEvent("focus-dashboard-search"));
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    };

    window.addEventListener("open-command-center", handleOpen);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("open-command-center", handleOpen);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Fetch initial authorized commands and attention items on modal open
  useEffect(() => {
    if (!open) return;

    // Reset state
    setQuery("");
    setSelectedIndex(0);
    setSearchResults([]);

    const fetchCommands = async () => {
      try {
        const res = await fetch(`/api/commands?locale=${locale}`);
        if (res.ok) {
          const data = await res.json();
          setCommands(data);
        }
      } catch {
        // Safe fail-closed
      }
    };

    fetchCommands();

    // Focus input after DOM paint
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }, [open, locale]);

  // Debounced search on query change
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setLoading(false);
      setSelectedIndex(0);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&locale=${locale}`);
        if (res.ok) {
          const data: SearchResponse = await res.json();
          setSearchResults(data.groups || []);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setLoading(false);
        setSelectedIndex(0);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, locale]);

  // Compute flattened selectable items based on query
  const selectableItems = useMemo<SelectableItem[]>(() => {
    const trimmed = query.trim().toLowerCase();
    const items: SelectableItem[] = [];

    if (trimmed.length < 2) {
      // 1. Attention items
      commands.attention.forEach((att) => {
        items.push({
          id: att.id,
          title: att.title,
          subtitle: att.description,
          href: att.href,
          groupKey: "attention",
          groupLabel: t("attention"),
          severity: att.severity
        });
      });

      // 2. Actions
      commands.actions.forEach((act) => {
        items.push({
          id: act.id,
          title: act.title,
          subtitle: act.subtitle,
          href: act.href,
          groupKey: "actions",
          groupLabel: t("actions"),
          badge: act.badge
        });
      });

      // 3. Navigation
      commands.navigation.forEach((nav) => {
        items.push({
          id: nav.id,
          title: nav.title,
          subtitle: nav.subtitle,
          href: nav.href,
          groupKey: "navigation",
          groupLabel: t("navigation"),
          badge: nav.badge
        });
      });

      return items;
    }

    // When query is typed:
    // Filter matching actions
    const matchingActions = commands.actions.filter(
      (a) => a.title.toLowerCase().includes(trimmed) || (a.subtitle && a.subtitle.toLowerCase().includes(trimmed))
    );
    matchingActions.forEach((act) => {
      items.push({
        id: act.id,
        title: act.title,
        subtitle: act.subtitle,
        href: act.href,
        groupKey: "actions",
        groupLabel: t("actions")
      });
    });

    // Filter matching navigation
    const matchingNav = commands.navigation.filter(
      (n) => n.title.toLowerCase().includes(trimmed) || (n.subtitle && n.subtitle.toLowerCase().includes(trimmed))
    );
    matchingNav.forEach((nav) => {
      items.push({
        id: nav.id,
        title: nav.title,
        subtitle: nav.subtitle,
        href: nav.href,
        groupKey: "navigation",
        groupLabel: t("navigation")
      });
    });

    // Search results records
    searchResults.forEach((group) => {
      const groupLabel = tSearch(`categories.${group.key}` as any) || group.key;
      group.items.forEach((item) => {
        items.push({
          id: item.id,
          title: item.title,
          subtitle: item.subtitle,
          href: item.href,
          groupKey: "records",
          groupLabel,
          badge: item.badge
        });
      });
    });

    return items;
  }, [query, commands, searchResults, t, tSearch]);

  // Navigate to selected item
  const handleSelect = (item: SelectableItem) => {
    setOpen(false);
    startTransition(() => {
      router.push(item.href);
    });
  };

  // Keyboard navigation within list
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }

    if (selectableItems.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % selectableItems.length);
      scrollItemIntoView((selectedIndex + 1) % selectableItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + selectableItems.length) % selectableItems.length);
      scrollItemIntoView((selectedIndex - 1 + selectableItems.length) % selectableItems.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const current = selectableItems[selectedIndex];
      if (current) {
        handleSelect(current);
      }
    }
  };

  const scrollItemIntoView = (index: number) => {
    if (!listRef.current) return;
    const elements = listRef.current.querySelectorAll("[data-selectable-item]");
    const target = elements[index] as HTMLElement | undefined;
    if (target) {
      target.scrollIntoView({ block: "nearest" });
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("open")}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-16 backdrop-blur-sm sm:pt-24 print:hidden animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        {/* Search Input Bar */}
        <div className="flex items-center border-b border-border px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground me-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("placeholder")}
            className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="p-1 text-muted-foreground hover:text-foreground"
              aria-label={t("close")}
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="hidden rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground sm:inline-block">
              ESC
            </kbd>
          )}
        </div>

        {/* Results List */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2">
          {loading && (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-club-primary border-t-transparent me-2" />
              {tSearch("loading")}
            </div>
          )}

          {!loading && selectableItems.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <p className="font-medium">{t("noCommands")}</p>
              {query && (
                <p className="mt-1 text-xs text-muted-foreground/80">
                  {tSearch("noResults")} &ldquo;{query}&rdquo;
                </p>
              )}
            </div>
          )}

          {!loading && selectableItems.length > 0 && (
            <div className="space-y-4">
              {/* Group items by groupLabel */}
              {Array.from(new Set(selectableItems.map((i) => i.groupLabel))).map((groupLabel) => {
                const groupItems = selectableItems.filter((i) => i.groupLabel === groupLabel);
                return (
                  <div key={groupLabel}>
                    <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {groupLabel}
                    </div>
                    <div className="mt-1 space-y-1">
                      {groupItems.map((item) => {
                        const globalIndex = selectableItems.indexOf(item);
                        const isSelected = globalIndex === selectedIndex;

                        let severityBadge = null;
                        if (item.severity === "danger") {
                          severityBadge = (
                            <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                              {t("attention")}
                            </span>
                          );
                        } else if (item.severity === "warning") {
                          severityBadge = (
                            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">
                              {t("attention")}
                            </span>
                          );
                        }

                        return (
                          <div
                            key={item.id}
                            data-selectable-item
                            onClick={() => handleSelect(item)}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                            className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                              isSelected
                                ? "bg-club-primary text-white"
                                : "text-foreground hover:bg-muted"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate font-medium">{item.title}</span>
                                {item.badge && (
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                                      isSelected
                                        ? "bg-white/20 text-white"
                                        : "bg-muted text-muted-foreground"
                                    }`}
                                  >
                                    {item.badge}
                                  </span>
                                )}
                                {severityBadge}
                              </div>
                              {item.subtitle && (
                                <p
                                  className={`truncate text-xs ${
                                    isSelected ? "text-white/80" : "text-muted-foreground"
                                  }`}
                                >
                                  {item.subtitle}
                                </p>
                              )}
                            </div>
                            <div className="ms-2 shrink-0">
                              {isArabic ? (
                                <ArrowLeft
                                  className={`h-4 w-4 ${
                                    isSelected ? "text-white" : "text-muted-foreground"
                                  }`}
                                />
                              ) : (
                                <ArrowRight
                                  className={`h-4 w-4 ${
                                    isSelected ? "text-white" : "text-muted-foreground"
                                  }`}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {query.trim().length >= 2 && (
          <div className="border-t border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push(`/${locale}/dashboard/search?q=${encodeURIComponent(query.trim())}`);
              }}
              className="flex items-center gap-1.5 font-medium text-club-primary hover:underline"
            >
              <span>{t("searchAll")}</span>
              {isArabic ? <ArrowLeft className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
