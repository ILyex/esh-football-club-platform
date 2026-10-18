import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getNativePrincipal } from "@/lib/native-session";
import { hasPermission } from "@/lib/permissions";
import { resolveTeamScope } from "@/lib/authz/policy";
import { writeAuditLog } from "@/lib/audit";
import { slugify } from "@/lib/utils";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const trainingInput = z.object({
  type: z.literal("training"), teamId: z.string().min(1), coachId: z.string().optional().default(""), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/), endTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  location: z.string().max(160).optional().default(""), notes: z.string().max(2000).optional().default("")
});
const meetingInput = z.object({
  type: z.literal("meeting"), title: z.string().trim().min(1).max(160), teamId: z.string().optional().default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), startTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/), location: z.string().max(160).optional().default(""), description: z.string().max(2000).optional().default("")
});
const bilingual = {
  titleAr: z.string().trim().min(1).max(200), contentAr: z.string().trim().min(1).max(20000),
  titleFr: z.string().trim().min(1).max(200), contentFr: z.string().trim().min(1).max(20000)
};
const arabicScript = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]/u;
const announcementInput = z.object({ type: z.literal("announcement"), ...bilingual, priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"), teamId: z.string().optional().default("") });
const newsInput = z.object({ type: z.literal("news"), ...bilingual, category: z.string().trim().max(80).optional().default("") });

async function uniqueNewsSlug(locale: string, title: string): Promise<string> {
  const base = slugify(title) || (locale === "fr" ? "actualite" : "khabar");
  let slug = base;
  let suffix = 1;
  while (await db.newsTranslation.findFirst({ where: { locale, slug }, select: { id: true } })) slug = `${base}-${++suffix}`;
  return slug;
}

export async function POST(request: Request) {
  const user = await getNativePrincipal(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);

  const meeting = meetingInput.safeParse(body);
  if (meeting.success) {
    if (!hasPermission(user, "meetings.schedule")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const scope = await resolveTeamScope(db, user);
    const teamId = meeting.data.teamId || null;
    if (scope.restricted && (!teamId || !scope.teamIds.includes(teamId))) return NextResponse.json({ error: "team_scope_forbidden" }, { status: 403 });
    const team = teamId ? await db.team.findUnique({ where: { id: teamId }, select: { id: true, name: true } }) : null;
    if (teamId && !team) return NextResponse.json({ error: "team_not_found" }, { status: 404 });
    const startDateTime = new Date(`${meeting.data.date}T${meeting.data.startTime}:00+01:00`);
    const endDateTime = new Date(`${meeting.data.date}T${meeting.data.endTime}:00+01:00`);
    if (!Number.isFinite(startDateTime.getTime()) || !Number.isFinite(endDateTime.getTime()) || endDateTime <= startDateTime) return NextResponse.json({ error: "invalid_meeting_time" }, { status: 400 });
    const created = await db.$transaction(async (tx) => {
      const event = await tx.calendarEvent.create({ data: {
        title: meeting.data.title, type: "MEETING", startDateTime, endDateTime,
        location: meeting.data.location || null, description: meeting.data.description || null, teamId
      } });
      await writeAuditLog({ userId: user.id, action: "meeting.mobile_schedule", entityType: "CalendarEvent", entityId: event.id, changes: { after: meeting.data } }, tx);
      return event;
    });
    try {
      const { notifyCalendarManagersOfMeeting } = await import("@/lib/push/admin-meeting-push");
      await notifyCalendarManagersOfMeeting(created);
    } catch (error) {
      console.error("[MobileMeeting] Meeting was saved, but notification delivery failed.", error instanceof Error ? error.message : "unknown error");
    }
    revalidatePath("/[locale]/dashboard/calendar", "page");
    revalidatePath("/[locale]/dashboard/meeting-minutes", "page");
    revalidatePath("/[locale]", "page");
    return NextResponse.json({ id: created.id }, { status: 201 });
  }

  const training = trainingInput.safeParse(body);
  if (training.success) {
    if (!hasPermission(user, "training.manage")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const scope = await resolveTeamScope(db, user);
    if (scope.restricted && !scope.teamIds.includes(training.data.teamId)) return NextResponse.json({ error: "team_scope_forbidden" }, { status: 403 });
    const team = await db.team.findUnique({ where: { id: training.data.teamId }, select: { id: true, name: true } });
    if (!team) return NextResponse.json({ error: "team_not_found" }, { status: 404 });
    const coachId = training.data.coachId || null;
    if (coachId) {
      const coach = await db.staff.findFirst({
        where: {
          id: coachId,
          status: "ACTIVE",
          role: { in: ["HEAD_COACH", "ASSISTANT_COACH", "GOALKEEPING_COACH", "FITNESS_COACH"] },
          OR: [{ teamId: team.id }, { teamAssignments: { some: { teamId: team.id } } }]
        }, select: { id: true }
      });
      if (!coach) return NextResponse.json({ error: "coach_not_assigned_to_team" }, { status: 400 });
    }

    // Club operations are in Africa/Algiers (UTC+1); persist absolute instants
    // so the mobile and web calendars render the same session time.
    const start = new Date(`${training.data.date}T${training.data.startTime}:00+01:00`);
    const end = new Date(`${training.data.date}T${training.data.endTime}:00+01:00`);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return NextResponse.json({ error: "invalid_training_time" }, { status: 400 });
    const date = new Date(`${training.data.date}T00:00:00+01:00`);
    const session = await db.$transaction(async (tx) => {
      const created = await tx.trainingSession.create({ data: { date, teamId: team.id, coachId, startTime: start, endTime: end, location: training.data.location || null, notes: training.data.notes || null, status: "SCHEDULED" } });
      await tx.calendarEvent.create({ data: { title: `Training · ${team.name}`, type: "TRAINING", startDateTime: start, endDateTime: end, location: training.data.location || null, teamId: team.id, relatedTrainingId: created.id } });
      await writeAuditLog({ userId: user.id, action: "training.create", entityType: "TrainingSession", entityId: created.id, changes: { after: training.data } }, tx);
      return created;
    });
    revalidatePath("/[locale]/dashboard/training", "page");
    revalidatePath("/[locale]/dashboard/calendar", "page");
    revalidatePath("/[locale]", "page");
    return NextResponse.json({ id: session.id }, { status: 201 });
  }

  const announcement = announcementInput.safeParse(body);
  if (announcement.success) {
    if (!hasPermission(user, "announcements.manage")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const scope = await resolveTeamScope(db, user);
    const teamId = announcement.data.teamId || null;
    if (scope.restricted && (!teamId || !scope.teamIds.includes(teamId))) return NextResponse.json({ error: "team_scope_forbidden" }, { status: 403 });
    const now = new Date();
    const created = await db.$transaction(async (tx) => {
      const item = await tx.announcement.create({ data: {
        priority: announcement.data.priority, teamId, startDate: now, homepageVisibility: true, status: "PUBLISHED", createdById: user.id,
        translations: { create: [
          { locale: "ar", title: announcement.data.titleAr, content: announcement.data.contentAr },
          { locale: "fr", title: announcement.data.titleFr, content: announcement.data.contentFr }
        ] }
      } });
      await writeAuditLog({ userId: user.id, action: "announcement.create", entityType: "Announcement", entityId: item.id, changes: { after: announcement.data } }, tx);
      return item;
    });
    revalidatePath("/[locale]/dashboard/announcements", "page");
    revalidatePath("/[locale]", "page");
    return NextResponse.json({ id: created.id }, { status: 201 });
  }

  const news = newsInput.safeParse(body);
  if (news.success) {
    if (!hasPermission(user, "news.create")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    if (arabicScript.test(news.data.titleFr) || arabicScript.test(news.data.contentFr)) return NextResponse.json({ error: "french_translation_must_be_in_french" }, { status: 400 });
    const [slugAr, slugFr] = await Promise.all([uniqueNewsSlug("ar", news.data.titleAr), uniqueNewsSlug("fr", news.data.titleFr)]);
    const created = await db.$transaction(async (tx) => {
      const item = await tx.news.create({ data: {
        authorId: user.id, category: news.data.category || null, status: "PUBLISHED", publishedAt: new Date(),
        translations: { create: [
          { locale: "ar", title: news.data.titleAr, slug: slugAr, content: news.data.contentAr },
          { locale: "fr", title: news.data.titleFr, slug: slugFr, content: news.data.contentFr }
        ] }
      } });
      await writeAuditLog({ userId: user.id, action: "news.create", entityType: "News", entityId: item.id, changes: { after: news.data } }, tx);
      return item;
    });
    revalidatePath("/[locale]/dashboard/news", "page");
    revalidatePath("/[locale]/news", "page");
    revalidatePath("/[locale]", "page");
    return NextResponse.json({ id: created.id, slugs: { ar: slugAr, fr: slugFr } }, { status: 201 });
  }

  return NextResponse.json({ error: "invalid_input", details: [meeting.error, training.error, announcement.error, news.error].map((error) => error.issues.map((issue) => ({ path: issue.path, message: issue.message }))) }, { status: 400 });
}
