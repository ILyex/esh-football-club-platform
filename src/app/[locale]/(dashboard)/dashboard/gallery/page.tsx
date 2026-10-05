import { DashboardTeamCategorySelect } from "@/components/shared/dashboard-team-category-select";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requirePermission, hasPermission } from "@/lib/permissions";
import { getEffectiveTeamId, getAuthorizedTeams } from "@/lib/team-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function GalleryListPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ team?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await requirePermission("gallery.view");
  const t = await getTranslations("gallery");
  const tTeams = await getTranslations("teams");
  const tCommon = await getTranslations("common");
  const canManage = hasPermission(user, "gallery.manage");

  const effectiveTeamId = await getEffectiveTeamId(sp.team);

  const [albums, teams] = await Promise.all([
    db.album.findMany({
      where: effectiveTeamId ? { teamId: effectiveTeamId } : {},
      include: { _count: { select: { media: true } } },
      orderBy: { createdAt: "desc" }
    }),
    getAuthorizedTeams()
  ]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        {canManage && (
          <Link href={`/${locale}/dashboard/gallery/new`}>
            <Button>{t("addAlbum")}</Button>
          </Link>
        )}
      </div>

      <form className="dashboard-filter-toolbar mb-4">
        <DashboardTeamCategorySelect
          value={sp.team ?? effectiveTeamId ?? "ALL"}
          options={teams.map((tm) => ({ id: tm.id, label: tTeams(`categories.${tm.category}` as any) }))}
          allLabel={tTeams("allTeams")}
          locale={locale}
        />
        <Button type="submit" variant="outline">
          {tCommon("filter")}
        </Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {albums.map((album) => (
          <Link
            key={album.id}
            href={`/${locale}/dashboard/gallery/${album.id}`}
            className="block overflow-hidden rounded-lg border border-border bg-card"
          >
            <div className="flex h-32 items-center justify-center bg-muted text-xs text-muted-foreground">
              {album.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- external CDN URL
                <img src={album.coverImageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span>{tCommon("noResults")}</span>
              )}
            </div>
            <div className="p-3">
              <p className="text-sm font-medium">{album.name}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge tone="neutral">{t(`categories.${album.category}` as any)}</Badge>
                <span>{album._count.media} {tCommon("images")}</span>
                {!album.published && <Badge tone="warning">{t("fields.published")}: —</Badge>}
              </div>
            </div>
          </Link>
        ))}
        {albums.length === 0 && (
          <p className="col-span-full rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            {tCommon("noResults")}
          </p>
        )}
      </div>
    </div>
  );
}
