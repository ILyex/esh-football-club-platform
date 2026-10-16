"use client";

import { useState } from "react";
import {
  Trophy,
  Coins,
  FileText,
  Globe,
  ShieldCheck,
  Activity,
  CheckSquare,
  Square,
  Search,
  CheckCircle2,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PERMISSION_CATEGORIES,
  getPermissionMeta,
  type PermissionMeta
} from "@/lib/permissions-dictionary";

interface PermissionItem {
  id: string;
  key: string;
  group: string;
  description: string | null;
}

interface RolePermissionsMatrixProps {
  allPermissions: PermissionItem[];
  grantedKeys: string[];
  locale: string;
  isSystemRole?: boolean;
}

export function RolePermissionsMatrix({
  allPermissions,
  grantedKeys,
  locale,
  isSystemRole
}: RolePermissionsMatrixProps) {
  const isAr = locale === "ar";
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set(grantedKeys));
  const [searchQuery, setSearchQuery] = useState("");

  const icons = {
    sporting: Trophy,
    medical: Activity,
    finance: Coins,
    governance: FileText,
    media: Globe,
    security: ShieldCheck
  };

  // Enhance permissions with metadata
  const enriched = allPermissions.map((p) => {
    const meta = getPermissionMeta(p.key, p.group);
    return {
      ...p,
      meta
    };
  });

  // Filter if search query
  const filtered = enriched.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.key.toLowerCase().includes(q) ||
      p.meta.labelAr.toLowerCase().includes(q) ||
      p.meta.labelFr.toLowerCase().includes(q) ||
      (p.meta.descAr && p.meta.descAr.toLowerCase().includes(q)) ||
      (p.meta.descFr && p.meta.descFr.toLowerCase().includes(q))
    );
  });

  // Group by category
  const categoriesList = Object.keys(PERMISSION_CATEGORIES) as (keyof typeof PERMISSION_CATEGORIES)[];

  function toggleKey(key: string) {
    if (isSystemRole) return;
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleCategory(cat: keyof typeof PERMISSION_CATEGORIES) {
    if (isSystemRole) return;
    const catKeys = enriched.filter((p) => p.meta.category === cat).map((p) => p.key);
    const allSelected = catKeys.every((k) => selectedKeys.has(k));

    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        catKeys.forEach((k) => next.delete(k));
      } else {
        catKeys.forEach((k) => next.add(k));
      }
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {/* Search and summary bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isAr ? "بحث في مصفوفة الصلاحيات..." : "Rechercher une permission..."}
            className="w-full rounded-lg border border-border bg-background ps-9 pe-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-medium">
          <span className="text-muted-foreground">{isAr ? "المفعلة:" : "Actives:"}</span>
          <span className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 font-bold font-mono text-primary">
            {selectedKeys.size} / {allPermissions.length}
          </span>
        </div>
      </div>

      {/* Hidden inputs for form submission */}
      {Array.from(selectedKeys).map((k) => (
        <input key={k} type="hidden" name="permissionKeys" value={k} />
      ))}

      {/* Domain Cards */}
      <div className="space-y-6">
        {categoriesList.map((catKey) => {
          const cat = PERMISSION_CATEGORIES[catKey];
          const Icon = icons[catKey];
          const items = filtered.filter((p) => p.meta.category === catKey);

          if (items.length === 0) return null;

          const catAllKeys = enriched.filter((p) => p.meta.category === catKey).map((p) => p.key);
          const activeInCat = catAllKeys.filter((k) => selectedKeys.has(k)).length;
          const allInCatSelected = activeInCat === catAllKeys.length && catAllKeys.length > 0;

          return (
            <div
              key={catKey}
              className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm transition-all hover:border-border"
            >
              {/* Category Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-muted/30 px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shadow-xs">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">
                      {isAr ? cat.titleAr : cat.titleFr}
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      {activeInCat} / {catAllKeys.length} {isAr ? "صلاحيات مفعلة" : "permissions actives"}
                    </p>
                  </div>
                </div>

                {!isSystemRole && (
                  <button
                    type="button"
                    onClick={() => toggleCategory(catKey)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    {allInCatSelected ? (
                      <>
                        <CheckSquare className="h-3.5 w-3.5 text-primary" />
                        <span>{isAr ? "إلغاء تحديد الكل" : "Tout désélectionner"}</span>
                      </>
                    ) : (
                      <>
                        <Square className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{isAr ? "تحديد كل القطاع" : "Tout sélectionner"}</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Permissions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 justify-items-center">
                {items.map((perm) => {
                  const isChecked = selectedKeys.has(perm.key);

                  return (
                    <div
                      key={perm.id}
                      onClick={() => toggleKey(perm.key)}
                      className={`relative flex w-full max-w-2xl items-center justify-center gap-3 rounded-xl border p-3.5 text-center transition-all cursor-pointer ${
                        isChecked
                          ? "border-primary/40 bg-primary/[0.04] shadow-xs"
                          : "border-border/60 bg-card hover:bg-muted/20"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // handled by div
                        disabled={isSystemRole}
                        className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary pointer-events-none"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <p className="font-semibold text-xs text-foreground">
                            {isAr ? perm.meta.labelAr : perm.meta.labelFr}
                          </p>
                          <span className="font-mono text-[10px] text-muted-foreground/80 bg-muted/60 px-1.5 py-0.5 rounded shrink-0">
                            {perm.key}
                          </span>
                        </div>

                        {(perm.meta.descAr || perm.description) && (
                          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                            {isAr ? perm.meta.descAr ?? perm.description : perm.meta.descFr ?? perm.description}
                          </p>
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
    </div>
  );
}
