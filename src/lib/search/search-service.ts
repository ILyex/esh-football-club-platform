import "server-only";

import { db } from "@/lib/db";
import { getSessionOrThrow, hasPermission, type SessionUser } from "@/lib/permissions";
import { resolveUserTeamContext, type UserTeamContext } from "@/lib/team-context";
import { teamIdWhere, resolveTeamScope, type TeamScope } from "@/lib/authz/policy";
import { userDetailsHref } from "@/lib/user-route";

// ============================================================================
// PHASE 9A — AUTHORITATIVE GLOBAL SEARCH SERVICE
// ----------------------------------------------------------------------------
// Strictly enforces server-side permission gates and team-scoping invariants.
// A search result NEVER discloses the existence, count, or metadata of any
// record the caller cannot access in its corresponding module page.
// ============================================================================

export interface SearchResultItem {
  id: string;
  type: string;
  title: string;
  subtitle?: string | null;
  href: string;
  category: string;
  badge?: string | null;
  score: number;
}

export interface SearchCategoryGroup {
  key: string;
  labelKey: string;
  count: number;
  items: SearchResultItem[];
}

export interface SearchResponse {
  query: string;
  totalResults: number;
  groups: SearchCategoryGroup[];
}

export interface SearchOptions {
  locale?: string;
  limitPerCategory?: number;
  filterCategory?: string;
  scope?: TeamScope;
  user?: SessionUser;
}

/**
 * Normalizes user search queries: trims, collapses whitespace, bounds length.
 */
export function normalizeSearchQuery(rawQuery: string): string {
  if (!rawQuery) return "";
  return rawQuery
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

/**
 * Deterministic relevance ranking:
 * 1. Exact match (case-insensitive) = 100
 * 2. Prefix match (starts with query) = 75
 * 3. Word token boundary match = 50
 * 4. Substring containment = 25
 */
export function calculateRelevanceScore(text: string, query: string): number {
  if (!text || !query) return 0;
  const target = text.trim().toLowerCase();
  const q = query.trim().toLowerCase();

  if (target === q) return 100;
  if (target.startsWith(q)) return 75;
  const wordBoundaryRegex = new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
  if (wordBoundaryRegex.test(target)) return 50;
  if (target.includes(q)) return 25;
  return 10;
}

/**
 * Centralized global search query execution engine.
 */
export async function executeGlobalSearch(
  rawQuery: string,
  options?: SearchOptions
): Promise<SearchResponse> {
  const query = normalizeSearchQuery(rawQuery);
  const locale = options?.locale || "ar";
  const limit = Math.min(Math.max(options?.limitPerCategory ?? 5, 1), 20);
  const filterCategory = options?.filterCategory;

  // Short query guard: never execute full table scans on empty or 1-character queries
  if (query.length < 2) {
    return {
      query,
      totalResults: 0,
      groups: []
    };
  }

  // Authorize session and live team scope
  const user = options?.user ?? (await getSessionOrThrow());
  let scope = options?.scope;
  if (!scope) {
    try {
      const teamCtx = await resolveUserTeamContext();
      scope = teamCtx.scope;
    } catch {
      // Fallback when outside request context (e.g. unit tests or background scripts)
      scope = await resolveTeamScope(db, user);
    }
  }
  const isRestricted = scope.restricted;
  const authorizedTeamIds: string[] = isRestricted ? [...scope.teamIds] : [];

  // Team scope where clause for team-owned tables
  const teamScopedFilter = isRestricted ? { teamId: { in: authorizedTeamIds } } : {};

  // Case-insensitive query pattern
  const ci = { contains: query, mode: "insensitive" as const };

  const groups: SearchCategoryGroup[] = [];

  // 1. PLAYERS
  if (hasPermission(user, "players.view") && (!filterCategory || filterCategory === "players")) {
    const players = await db.player.findMany({
      where: {
        AND: [
          teamScopedFilter,
          {
            OR: [
              { firstName: ci },
              { lastName: ci },
              { nationality: ci }
            ]
          }
        ]
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        position: true,
        shirtNumber: true,
        team: { select: { name: true, category: true } }
      },
      take: limit
    });

    if (players.length > 0) {
      const items: SearchResultItem[] = players.map((p) => {
        const title = `${p.firstName} ${p.lastName}`;
        const subtitle = p.team ? `${p.position} • ${p.team.name}` : p.position;
        return {
          id: p.id,
          type: "player",
          title,
          subtitle,
          href: `/${locale}/dashboard/players/${p.id}`,
          category: "players",
          badge: p.shirtNumber ? `#${p.shirtNumber}` : undefined,
          score: Math.max(
            calculateRelevanceScore(title, query),
            calculateRelevanceScore(p.lastName, query),
            calculateRelevanceScore(p.firstName, query)
          )
        };
      });
      items.sort((a, b) => b.score - a.score);
      groups.push({ key: "players", labelKey: "categories.players", count: items.length, items });
    }
  }

  // 2. STAFF
  if (hasPermission(user, "staff.view") && (!filterCategory || filterCategory === "staff")) {
    const staffWhere: any = {
      // `role` is a Prisma enum, so it cannot use a text `contains` filter.
      // Search the localized name fields here; role labels are rendered in the
      // result but are not text-searchable at the Prisma layer.
      OR: [
        { firstName: ci },
        { lastName: ci },
        { firstNameFr: ci },
        { lastNameFr: ci }
      ]
    };

    if (isRestricted) {
      // Staff's multi-team assignment relation is named `teamAssignments` in
      // the Prisma schema (there is no `teams` relation on Staff).
      staffWhere.teamAssignments = {
        some: { teamId: { in: authorizedTeamIds } }
      };
    }

    const staffList = await db.staff.findMany({
      where: staffWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        firstNameFr: true,
        lastNameFr: true,
        role: true,
        team: {
          select: { name: true }
        }
      },
      take: limit
    });

    if (staffList.length > 0) {
      const items: SearchResultItem[] = staffList.map((s) => {
        const title = `${s.firstName} ${s.lastName}`;
        const teamName = s.team?.name;
        return {
          id: s.id,
          type: "staff",
          title,
          subtitle: teamName ? `${s.role} (${teamName})` : s.role,
          href: `/${locale}/dashboard/staff/${s.id}`,
          category: "staff",
          badge: s.role,
          score: Math.max(
            calculateRelevanceScore(title, query),
            calculateRelevanceScore(s.lastName, query),
            calculateRelevanceScore(s.firstNameFr ?? "", query),
            calculateRelevanceScore(s.lastNameFr ?? "", query)
          )
        };
      });
      items.sort((a, b) => b.score - a.score);
      groups.push({ key: "staff", labelKey: "categories.staff", count: items.length, items });
    }
  }

  // 3. TEAMS
  if (hasPermission(user, "teams.view") && (!filterCategory || filterCategory === "teams")) {
    const teamWhere: any = {
      active: true,
      OR: [{ name: ci }, { shortName: ci }]
    };
    if (isRestricted) {
      teamWhere.id = { in: authorizedTeamIds };
    }

    const teams = await db.team.findMany({
      where: teamWhere,
      select: {
        id: true,
        name: true,
        shortName: true,
        category: true
      },
      take: limit
    });

    if (teams.length > 0) {
      const items: SearchResultItem[] = teams.map((t) => ({
        id: t.id,
        type: "team",
        title: t.name,
        subtitle: t.shortName || t.category,
        href: `/${locale}/dashboard/teams/${t.id}`,
        category: "teams",
        badge: t.category,
        score: calculateRelevanceScore(t.name, query)
      }));
      items.sort((a, b) => b.score - a.score);
      groups.push({ key: "teams", labelKey: "categories.teams", count: items.length, items });
    }
  }

  // 4. MATCHES
  if (hasPermission(user, "matches.view") && (!filterCategory || filterCategory === "matches")) {
    const matchWhere: any = {
      AND: [
        teamScopedFilter,
        {
          OR: [{ homeTeamName: ci }, { awayTeamName: ci }, { stadium: ci }]
        }
      ]
    };

    const matches = await db.match.findMany({
      where: matchWhere,
      select: {
        id: true,
        homeTeamName: true,
        awayTeamName: true,
        matchDate: true,
        status: true,
        competition: { select: { name: true } },
        team: { select: { name: true } }
      },
      take: limit
    });

    if (matches.length > 0) {
      const items: SearchResultItem[] = matches.map((m) => {
        const title = `${m.homeTeamName} vs ${m.awayTeamName}`;
        const formattedDate = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(m.matchDate);
        return {
          id: m.id,
          type: "match",
          title,
          subtitle: `${m.competition.name} • ${formattedDate}`,
          href: `/${locale}/dashboard/matches/${m.id}`,
          category: "matches",
          badge: m.status,
          score: calculateRelevanceScore(title, query)
        };
      });
      items.sort((a, b) => b.score - a.score);
      groups.push({ key: "matches", labelKey: "categories.matches", count: items.length, items });
    }
  }

  // 5. COMPETITIONS
  if (hasPermission(user, "competitions.view") && (!filterCategory || filterCategory === "competitions")) {
    const compWhere: any = {
      AND: [
        teamScopedFilter,
        {
          OR: [{ name: ci }, { organization: ci }]
        }
      ]
    };

    const competitions = await db.competition.findMany({
      where: compWhere,
      select: {
        id: true,
        name: true,
        organization: true,
        season: { select: { label: true } }
      },
      take: limit
    });

    if (competitions.length > 0) {
      const items: SearchResultItem[] = competitions.map((c) => ({
        id: c.id,
        type: "competition",
        title: c.name,
        subtitle: c.organization ? `${c.season.label} • ${c.organization}` : c.season.label,
        href: `/${locale}/dashboard/competitions/${c.id}`,
        category: "competitions",
        badge: c.season.label,
        score: calculateRelevanceScore(c.name, query)
      }));
      items.sort((a, b) => b.score - a.score);
      groups.push({ key: "competitions", labelKey: "categories.competitions", count: items.length, items });
    }
  }

  // 6. TRAINING SESSIONS
  if (hasPermission(user, "training.view") && (!filterCategory || filterCategory === "training")) {
    const trainingWhere: any = {
      AND: [
        teamScopedFilter,
        {
          OR: [{ location: ci }, { notes: ci }]
        }
      ]
    };

    const sessions = await db.trainingSession.findMany({
      where: trainingWhere,
      select: {
        id: true,
        location: true,
        notes: true,
        date: true,
        status: true,
        team: { select: { name: true } },
        coach: { select: { firstName: true, lastName: true } }
      },
      take: limit
    });

    if (sessions.length > 0) {
      const items: SearchResultItem[] = sessions.map((s) => {
        const formattedDate = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(s.date);
        const title = s.team ? `${s.team.name} - ${s.location ?? "Entraînement"}` : (s.location ?? "Entraînement");
        const coachName = s.coach ? `${s.coach.firstName} ${s.coach.lastName}` : null;
        const subtitle = [s.team?.name, formattedDate, coachName].filter(Boolean).join(" • ");
        return {
          id: s.id,
          type: "training",
          title,
          subtitle,
          href: `/${locale}/dashboard/training/${s.id}`,
          category: "training",
          badge: s.status,
          score: Math.max(
            calculateRelevanceScore(title, query),
            calculateRelevanceScore(s.location ?? "", query)
          )
        };
      });
      items.sort((a, b) => b.score - a.score);
      groups.push({ key: "training", labelKey: "categories.training", count: items.length, items });
    }
  }

  // 7. DOCUMENTS
  if (hasPermission(user, "documents.view") && (!filterCategory || filterCategory === "documents")) {
    const canSeeRestricted = hasPermission(user, "documents.view.restricted");
    const docWhere: any = {
      AND: [
        teamScopedFilter,
        canSeeRestricted ? {} : { classification: { in: ["PUBLIC", "INTERNAL"] } },
        {
          OR: [{ name: ci }, { description: ci }]
        }
      ]
    };

    const documents = await db.document.findMany({
      where: docWhere,
      select: {
        id: true,
        name: true,
        category: true,
        classification: true,
        status: true
      },
      take: limit
    });

    if (documents.length > 0) {
      const items: SearchResultItem[] = documents.map((d) => ({
        id: d.id,
        type: "document",
        title: d.name,
        subtitle: `${d.category} • ${d.classification}`,
        href: `/${locale}/dashboard/documents`,
        category: "documents",
        badge: d.status,
        score: calculateRelevanceScore(d.name, query)
      }));
      items.sort((a, b) => b.score - a.score);
      groups.push({ key: "documents", labelKey: "categories.documents", count: items.length, items });
    }
  }

  // 8. CONTRACTS
  if (hasPermission(user, "contracts.view") && (!filterCategory || filterCategory === "contracts")) {
    const contractWhere: any = {
      AND: [
        teamScopedFilter,
        {
          OR: [
            { player: { OR: [{ firstName: ci }, { lastName: ci }] } },
            { staff: { OR: [{ firstName: ci }, { lastName: ci }] } },
            { notes: ci }
          ]
        }
      ]
    };

    const contracts = await db.contract.findMany({
      where: contractWhere,
      select: {
        id: true,
        type: true,
        status: true,
        player: { select: { firstName: true, lastName: true } },
        staff: { select: { firstName: true, lastName: true } }
      },
      take: limit
    });

    if (contracts.length > 0) {
      const items: SearchResultItem[] = contracts.map((c) => {
        const subject = c.player
          ? `${c.player.firstName} ${c.player.lastName}`
          : c.staff
          ? `${c.staff.firstName} ${c.staff.lastName}`
          : c.id;
        return {
          id: c.id,
          type: "contract",
          title: subject,
          subtitle: `${c.type} • ${c.status}`,
          href: `/${locale}/dashboard/contracts/${c.id}`,
          category: "contracts",
          badge: c.status,
          score: calculateRelevanceScore(subject, query)
        };
      });
      items.sort((a, b) => b.score - a.score);
      groups.push({ key: "contracts", labelKey: "categories.contracts", count: items.length, items });
    }
  }

  // 9. FINANCE (EXPENSES & BUDGETS)
  if (hasPermission(user, "finance.view") && (!filterCategory || filterCategory === "finance")) {
    const expenseWhere: any = {
      AND: [
        teamScopedFilter,
        {
          OR: [
            { referenceNumber: ci },
            { description: ci },
            { payeeName: ci }
          ]
        }
      ]
    };

    const expenses = await db.expense.findMany({
      where: expenseWhere,
      select: {
        id: true,
        referenceNumber: true,
        description: true,
        amount: true,
        payeeName: true,
        status: true
      },
      take: limit
    });

    if (expenses.length > 0) {
      const items: SearchResultItem[] = expenses.map((e) => ({
        id: e.id,
        type: "expense",
        title: e.description,
        subtitle: `${e.referenceNumber} • ${e.payeeName} • ${e.amount.toLocaleString()} DZD`,
        href: `/${locale}/dashboard/finance/expenses/${e.id}`,
        category: "finance",
        badge: e.status,
        score: Math.max(
          calculateRelevanceScore(e.description, query),
          calculateRelevanceScore(e.referenceNumber, query)
        )
      }));
      items.sort((a, b) => b.score - a.score);
      groups.push({ key: "finance", labelKey: "categories.finance", count: items.length, items });
    }
  }

  // 10. NEWS
  if (hasPermission(user, "news.view") && (!filterCategory || filterCategory === "news")) {
    const newsArticles = await db.news.findMany({
      where: {
        translations: {
          some: {
            OR: [{ title: ci }, { content: ci }]
          }
        }
      },
      select: {
        id: true,
        category: true,
        status: true,
        translations: {
          select: { locale: true, title: true }
        }
      },
      take: limit
    });

    if (newsArticles.length > 0) {
      const items: SearchResultItem[] = newsArticles.map((n) => {
        const trans = n.translations.find((t) => t.locale === locale) || n.translations[0];
        const title = trans?.title || n.id;
        return {
          id: n.id,
          type: "news",
          title,
          subtitle: n.category ? `${n.category} • ${n.status}` : n.status,
          href: `/${locale}/dashboard/news/${n.id}`,
          category: "news",
          badge: n.status,
          score: calculateRelevanceScore(title, query)
        };
      });
      items.sort((a, b) => b.score - a.score);
      groups.push({ key: "news", labelKey: "categories.news", count: items.length, items });
    }
  }

  // 11. ANNOUNCEMENTS
  if (hasPermission(user, "announcements.view") && (!filterCategory || filterCategory === "announcements")) {
    const announcements = await db.announcement.findMany({
      where: {
        translations: {
          some: {
            OR: [{ title: ci }, { content: ci }]
          }
        }
      },
      select: {
        id: true,
        priority: true,
        status: true,
        translations: {
          select: { locale: true, title: true }
        }
      },
      take: limit
    });

    if (announcements.length > 0) {
      const items: SearchResultItem[] = announcements.map((a) => {
        const trans = a.translations.find((t) => t.locale === locale) || a.translations[0];
        const title = trans?.title || a.id;
        return {
          id: a.id,
          type: "announcement",
          title,
          subtitle: `${a.priority} • ${a.status}`,
          href: `/${locale}/dashboard/announcements/${a.id}`,
          category: "announcements",
          badge: a.priority,
          score: calculateRelevanceScore(title, query)
        };
      });
      items.sort((a, b) => b.score - a.score);
      groups.push({ key: "announcements", labelKey: "categories.announcements", count: items.length, items });
    }
  }

  // 12. CORRESPONDENCE
  if (hasPermission(user, "correspondence.view") && (!filterCategory || filterCategory === "correspondence")) {
    const corrWhere: any = {
      AND: [
        teamScopedFilter,
        {
          OR: [{ subject: ci }, { referenceNumber: ci }, { sender: ci }, { recipient: ci }]
        }
      ]
    };

    const corrList = await db.correspondence.findMany({
      where: corrWhere,
      select: {
        id: true,
        subject: true,
        referenceNumber: true,
        type: true,
        status: true
      },
      take: limit
    });

    if (corrList.length > 0) {
      const items: SearchResultItem[] = corrList.map((c) => ({
        id: c.id,
        type: "correspondence",
        title: c.subject,
        subtitle: `${c.referenceNumber} • ${c.type}`,
        href: `/${locale}/dashboard/correspondence/${c.id}`,
        category: "correspondence",
        badge: c.status,
        score: Math.max(
          calculateRelevanceScore(c.subject, query),
          calculateRelevanceScore(c.referenceNumber, query)
        )
      }));
      items.sort((a, b) => b.score - a.score);
      groups.push({ key: "correspondence", labelKey: "categories.correspondence", count: items.length, items });
    }
  }

  // 13. MEETING MINUTES
  if (hasPermission(user, "meetings.view") && (!filterCategory || filterCategory === "meetings")) {
    const meetingWhere: any = {
      AND: [
        teamScopedFilter,
        {
          OR: [{ title: ci }, { location: ci }]
        }
      ]
    };

    const meetings = await db.meetingMinute.findMany({
      where: meetingWhere,
      select: {
        id: true,
        title: true,
        location: true,
        date: true,
        status: true
      },
      take: limit
    });

    if (meetings.length > 0) {
      const items: SearchResultItem[] = meetings.map((m) => {
        const formattedDate = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(m.date);
        return {
          id: m.id,
          type: "meeting",
          title: m.title,
          subtitle: m.location ? `${formattedDate} • ${m.location}` : formattedDate,
          href: `/${locale}/dashboard/meeting-minutes/${m.id}`,
          category: "meetings",
          badge: m.status,
          score: calculateRelevanceScore(m.title, query)
        };
      });
      items.sort((a, b) => b.score - a.score);
      groups.push({ key: "meetings", labelKey: "categories.meetings", count: items.length, items });
    }
  }

  // 14. USERS
  if (hasPermission(user, "users.view") && (!filterCategory || filterCategory === "users")) {
    const users = await db.user.findMany({
      where: {
        deletedAt: null,
        OR: [{ name: ci }, { email: ci }]
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: { select: { name: true } }
      },
      take: limit
    });

    if (users.length > 0) {
      const items: SearchResultItem[] = users.map((u) => ({
        id: u.id,
        type: "user",
        title: u.name,
        subtitle: `${u.email} • ${u.role.name}`,
        href: userDetailsHref(locale, u.name, u.id),
        category: "users",
        badge: u.role.name,
        score: Math.max(
          calculateRelevanceScore(u.name, query),
          calculateRelevanceScore(u.email, query)
        )
      }));
      items.sort((a, b) => b.score - a.score);
      groups.push({ key: "users", labelKey: "categories.users", count: items.length, items });
    }
  }

  // 15. ROLES
  if (hasPermission(user, "roles.manage") && (!filterCategory || filterCategory === "roles")) {
    const roles = await db.role.findMany({
      where: {
        OR: [{ name: ci }, { key: ci }, { description: ci }]
      },
      select: {
        id: true,
        name: true,
        key: true,
        description: true
      },
      take: limit
    });

    if (roles.length > 0) {
      const items: SearchResultItem[] = roles.map((r) => ({
        id: r.id,
        type: "role",
        title: r.name,
        subtitle: r.description || r.key,
        href: `/${locale}/dashboard/roles/${r.id}`,
        category: "roles",
        badge: r.key,
        score: Math.max(
          calculateRelevanceScore(r.name, query),
          calculateRelevanceScore(r.key, query)
        )
      }));
      items.sort((a, b) => b.score - a.score);
      groups.push({ key: "roles", labelKey: "categories.roles", count: items.length, items });
    }
  }

  const totalResults = groups.reduce((acc, g) => acc + g.count, 0);

  return {
    query,
    totalResults,
    groups
  };
}
