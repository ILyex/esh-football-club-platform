import "server-only";
import { db } from "@/lib/db";
import { runAICompletion, checkAIAvailability } from "./provider";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export interface ParsedEventItem {
  playerId: string | null;
  playerName: string;
  shirtNumber?: number | null;
  type: "GOAL" | "ASSIST" | "YELLOW_CARD" | "RED_CARD";
  minute: number;
  notes?: string;
  matchedPlayerName?: string;
}

export interface RefereeReportAnalysisResult {
  success: boolean;
  eventsCreated: number;
  events: ParsedEventItem[];
  summary: string;
  detectedScore?: { home: number; away: number } | null;
  aiProviderUsed: "LOCAL_OLLAMA" | "INTELLIGENT_NLP_ENGINE";
}

/**
 * Normalizes Arabic and Latin player names for robust fuzzy matching.
 */
function normalizeName(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/[أإآء]/g, "ا")
    .replace(/[ة]/g, "ه")
    .replace(/[ى]/g, "ي")
    .replace(/^(ال)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type SquadPlayer = {
  id: string;
  firstName: string;
  lastName: string;
  shirtNumber: number | null;
  teamId?: string | null;
};

/**
 * Attempts to match a name or shirt number against a squad of players.
 */
function findBestPlayerMatch(
  queryName: string,
  queryNumber: number | null | undefined,
  squad: SquadPlayer[]
): SquadPlayer | null {
  if (queryNumber) {
    const byNumber = squad.find((p) => p.shirtNumber === queryNumber);
    if (byNumber) {
      return byNumber;
    }
  }

  const normQuery = normalizeName(queryName);
  if (!normQuery) return null;

  for (const p of squad) {
    const normFirst = normalizeName(p.firstName);
    const normLast = normalizeName(p.lastName);
    const normFull = `${normFirst} ${normLast}`;
    const normRev = `${normLast} ${normFirst}`;

    if (
      normQuery === normFull ||
      normQuery === normRev ||
      normQuery === normLast ||
      normQuery.includes(normLast) ||
      normLast.includes(normQuery) ||
      (normFirst.length > 2 && normQuery.includes(normFirst))
    ) {
      return p;
    }
  }

  return null;
}

/**
 * Deterministic NLP rule-based fallback if Ollama is offline or unavailable.
 * Identifies Arabic and French phrases for goals, cards, and penalties.
 */
function parseReportDeterministically(
  text: string,
  squad: SquadPlayer[]
): { events: ParsedEventItem[]; detectedScore?: { home: number; away: number } | null } {
  const events: ParsedEventItem[] = [];
  const lines = text.split(/[\r\n;.]+/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Minute extractor e.g. "د 34", "د34", "34'", "min 34", "34mn", "minute 34"
    const minuteMatch = line.match(/(?:د|دقيقة|min|mn|minute)?\s*(\d{1,3})\s*(?:'|د|دقيقة|min|mn)?/i);
    const minute = minuteMatch ? Math.min(120, Math.max(1, parseInt(minuteMatch[1]!, 10))) : 45;

    // Shirt number extractor e.g. "رقم 9", "n° 9", "#9"
    const numberMatch = line.match(/(?:رقم|n°|#)\s*(\d{1,2})/i);
    const shirtNumber = numberMatch ? parseInt(numberMatch[1]!, 10) : null;

    // Goal detection: "هدف", "سجل", "but", "goal", "marqué par"
    if (/هدف|سجل|أهداف|but|goal|marqu/i.test(line)) {
      const matched = findBestPlayerMatch(line, shirtNumber, squad);
      const fullName = matched ? `${matched.firstName} ${matched.lastName}` : line.slice(0, 30);
      events.push({
        playerId: matched?.id || null,
        playerName: fullName,
        shirtNumber,
        type: "GOAL",
        minute,
        notes: `هدف مسجل بتقرير الحكم (${line.slice(0, 40)})`,
        matchedPlayerName: matched ? fullName : undefined
      });
    }
    // Yellow card detection: "بطاقة صفراء", "إنذار", "carton jaune", "avertissement"
    else if (/صفراء|إنذار|انذار|jaune|avertissement|yellow/i.test(line)) {
      const matched = findBestPlayerMatch(line, shirtNumber, squad);
      const fullName = matched ? `${matched.firstName} ${matched.lastName}` : line.slice(0, 30);
      events.push({
        playerId: matched?.id || null,
        playerName: fullName,
        shirtNumber,
        type: "YELLOW_CARD",
        minute,
        notes: `بطاقة صفراء رسمية بتقرير الحكم (${line.slice(0, 40)})`,
        matchedPlayerName: matched ? fullName : undefined
      });
    }
    // Red card detection: "بطاقة حمراء", "طرد", "carton rouge", "expulsion"
    else if (/حمراء|طرد|rouge|expulsion|red card/i.test(line)) {
      const matched = findBestPlayerMatch(line, shirtNumber, squad);
      const fullName = matched ? `${matched.firstName} ${matched.lastName}` : line.slice(0, 30);
      events.push({
        playerId: matched?.id || null,
        playerName: fullName,
        shirtNumber,
        type: "RED_CARD",
        minute,
        notes: `بطاقة حمراء رسمية بتقرير الحكم (${line.slice(0, 40)})`,
        matchedPlayerName: matched ? fullName : undefined
      });
    }
    // Assist detection: "تمريرة حاسمة", "صنع", "passe d", "assist"
    else if (/تمريرة|صنع|passe d|assist/i.test(line)) {
      const matched = findBestPlayerMatch(line, shirtNumber, squad);
      if (matched) {
        const fullName = `${matched.firstName} ${matched.lastName}`;
        events.push({
          playerId: matched.id,
          playerName: fullName,
          shirtNumber,
          type: "ASSIST",
          minute,
          notes: `تمريرة حاسمة بتقرير الحكم (${line.slice(0, 40)})`,
          matchedPlayerName: fullName
        });
      }
    }
  }

  // Score detection e.g. "2 - 1", "2-0", "(1)-(0)"
  const scoreMatch = text.match(/(\d+)\s*[-–:]\s*(\d+)/);
  const detectedScore = scoreMatch ? { home: parseInt(scoreMatch[1]!, 10), away: parseInt(scoreMatch[2]!, 10) } : null;

  return { events, detectedScore };
}

/**
 * Main AI Agent service: Parses referee match report, recognizes players,
 * and automatically records goals, assists, yellow and red cards.
 */
export async function parseAndApplyRefereeReportWithAI(params: {
  matchId: string;
  reportText?: string;
  userId: string;
}): Promise<RefereeReportAnalysisResult> {
  const { matchId, reportText, userId } = params;

  // 1. Fetch match, team, and squad players
  const match = await db.match.findUniqueOrThrow({
    where: { id: matchId },
    include: {
      team: { include: { players: true } },
      documents: true,
      events: true
    }
  });

  // Pull all available club players or team players for recognition
  const squad = await db.player.findMany({
    where: { status: { not: "ARCHIVED" } },
    select: { id: true, firstName: true, lastName: true, shirtNumber: true, teamId: true }
  });

  // Determine report text to analyze
  let textToAnalyze = (reportText || "").trim();
  if (!textToAnalyze) {
    textToAnalyze = match.matchReport || "";
  }
  if (!textToAnalyze) {
    // If empty, look into attached referee report document metadata/names
    const refDoc = match.documents.find(
      (d) =>
        d.name.includes("تقرير حكم") ||
        d.name.toLowerCase().includes("rapport") ||
        d.originalName?.toLowerCase().includes("referee")
    );
    if (refDoc) {
      textToAnalyze = `${refDoc.name} - ${refDoc.originalName || ""}`;
    }
  }

  if (!textToAnalyze) {
    return {
      success: false,
      eventsCreated: 0,
      events: [],
      summary: "لم يتم العثور على نص أو وثيقة لتقرير الحكم لتحليلها.",
      aiProviderUsed: "INTELLIGENT_NLP_ENGINE"
    };
  }

  let parsedEvents: ParsedEventItem[] = [];
  let detectedScore: { home: number; away: number } | null = null;
  let aiProviderUsed: "LOCAL_OLLAMA" | "INTELLIGENT_NLP_ENGINE" = "INTELLIGENT_NLP_ENGINE";

  // Squad list formatting for AI prompt
  const squadRoster = squad
    .map((p) => `- ID: ${p.id} | الاسم: ${p.firstName} ${p.lastName} | الرقم: ${p.shirtNumber ?? "غير محدد"}`)
    .join("\n");

  const systemPrompt = `أنت المساعد الرياضي الذكي لنادي أمل سيدي حسني (ESH) المخصص لتحليل تقارير حكام مباريات كرة القدم الرسمية.
مهمتك: قراءة نص تقرير الحكم واستخراج كافة أحداث المباراة الخاصة باللاعبين بدقة متناهية:
1. الأهداف المسجلة (GOAL): اسم اللاعب ورقم قميصه والدقيقة.
2. التمريرات الحاسمة (ASSIST): اسم اللاعب والدقيقة.
3. البطاقات الصفراء (YELLOW_CARD): اسم اللاعب والدقيقة والسبب.
4. البطاقات الحمراء (RED_CARD): اسم اللاعب والدقيقة والسبب.

طابق أسماء اللاعبين الواردة في التقرير مع قائمة لاعبي النادي التالية فقط:
${squadRoster}

أرجع الناتج بصيغة JSON فقط بهذا الشكل:
{
  "events": [
    {
      "playerId": "معرف اللاعب من القائمة أو null",
      "playerName": "اسم اللاعب",
      "shirtNumber": 9,
      "type": "GOAL",
      "minute": 34,
      "notes": "ملاحظات إضافية"
    }
  ],
  "homeScore": 2,
  "awayScore": 1,
  "summary": "ملخص تحليلي للأحداث"
}`;

  const availability = await checkAIAvailability();
  if (availability.available) {
    try {
      const aiResponse = await runAICompletion({
        system: systemPrompt,
        input: `<referee_report>\n${textToAnalyze}\n</referee_report>`,
        maxTokens: 1200
      });

      // Extract JSON payload
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.events)) {
          parsedEvents = parsed.events.map((e: any) => {
            const matched = e.playerId
              ? squad.find((p) => p.id === e.playerId)
              : findBestPlayerMatch(e.playerName || "", e.shirtNumber, squad);

            return {
              playerId: matched?.id || null,
              playerName: e.playerName || (matched ? `${matched.firstName} ${matched.lastName}` : "لاعب غير محدد"),
              shirtNumber: e.shirtNumber ?? matched?.shirtNumber ?? null,
              type: ["GOAL", "ASSIST", "YELLOW_CARD", "RED_CARD"].includes(e.type) ? e.type : "GOAL",
              minute: Number(e.minute) || 45,
              notes: e.notes || "أُضيف من تقرير الحكم باستخدام المساعد الذكي",
              matchedPlayerName: matched ? `${matched.firstName} ${matched.lastName}` : undefined
            };
          });

          if (parsed.homeScore !== undefined && parsed.awayScore !== undefined) {
            detectedScore = { home: Number(parsed.homeScore), away: Number(parsed.awayScore) };
          }
          aiProviderUsed = "LOCAL_OLLAMA";
        }
      }
    } catch (err) {
      console.warn("[AI Referee Report] Fallback to deterministic NLP engine due to error:", err);
    }
  }

  // Fallback to deterministic engine if AI failed or returned empty
  if (parsedEvents.length === 0) {
    const fallback = parseReportDeterministically(textToAnalyze, squad);
    parsedEvents = fallback.events;
    if (fallback.detectedScore) detectedScore = fallback.detectedScore;
    aiProviderUsed = "INTELLIGENT_NLP_ENGINE";
  }

  // Filter only matched club player events with valid IDs
  const validEvents = parsedEvents.filter((e) => e.playerId !== null);

  // Avoid creating exact duplicate events already present in this match
  const existingEvents = match.events;
  const newEventsToCreate = validEvents.filter(
    (ve) =>
      !existingEvents.some(
        (ee) => ee.playerId === ve.playerId && ee.type === ve.type && Math.abs(ee.minute - ve.minute) <= 2
      )
  );

  // Persist into database
  for (const item of newEventsToCreate) {
    await db.matchEvent.create({
      data: {
        matchId: match.id,
        playerId: item.playerId,
        type: item.type,
        source: "REFEREE_REPORT",
        minute: item.minute,
        notes: item.notes || "أُضيف من تقرير الحكم باستخدام المساعد الذكي"
      }
    });
  }

  // Update match report and status if not set
  await db.match.update({
    where: { id: matchId },
    data: {
      matchReport: textToAnalyze,
      ...(detectedScore && match.homeScore === null ? { homeScore: detectedScore.home, awayScore: detectedScore.away } : {})
    }
  });

  // Audit log
  await writeAuditLog({
    userId,
    action: "match.referee_report_ai_analyzed",
    entityType: "Match",
    entityId: match.id,
    changes: {
      eventsCreatedCount: newEventsToCreate.length,
      aiProviderUsed,
      events: newEventsToCreate.map((e) => ({
        type: e.type,
        playerId: e.playerId,
        playerName: e.matchedPlayerName,
        minute: e.minute
      }))
    }
  });

  // Revalidate views
  revalidatePath(`/[locale]/dashboard/matches/${matchId}`, "page");
  revalidatePath("/[locale]/dashboard/matches", "page");
  revalidatePath("/[locale]/dashboard/players", "page");

  const summary =
    newEventsToCreate.length > 0
      ? `تم التعرف بنجاح على ${newEventsToCreate.length} حدث رسمي في تقرير الحكم (أهداف/بطاقات) وتحديث سجلات وإحصائيات اللاعبين تلقائياً.`
      : validEvents.length > 0
      ? `تمت مطابقة الأحداث مع السجلات الحالية؛ الأحداث مسجلة مسبقاً بالفعل في ملفات اللاعبين.`
      : `تم فحص التقرير بنجاح ولكن لم يتم العثور على أهداف أو بطاقات منسوبة للاعبي الفريق.`;

  return {
    success: true,
    eventsCreated: newEventsToCreate.length,
    events: parsedEvents,
    summary,
    detectedScore,
    aiProviderUsed
  };
}
