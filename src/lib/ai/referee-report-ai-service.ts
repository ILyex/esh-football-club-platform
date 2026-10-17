import "server-only";
import { db } from "@/lib/db";
import { runAICompletion, checkAIAvailability } from "./provider";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { AIError } from "./types";

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
  aiProviderUsed: "CLOUDFLARE_WORKERS_AI" | "LOCAL_OLLAMA" | "INTELLIGENT_NLP_ENGINE";
  aiFallback?: "quota" | "unavailable" | null;
}

/**
 * Normalizes Arabic and Latin player names for robust fuzzy matching.
 */
function normalizeName(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFKC")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f\u064B-\u065F\u0670ـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ة]/g, "ه")
    .replace(/[ى]/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
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
    const byNumber = squad.filter((p) => p.shirtNumber === queryNumber);
    if (byNumber.length === 1) return byNumber[0]!;
  }

  const normQuery = normalizeName(queryName);
  if (!normQuery) return null;
  const queryTokens = new Set(normQuery.split(" "));
  const ranked = squad.map((player) => {
    const first = normalizeName(player.firstName);
    const last = normalizeName(player.lastName);
    const firstTokens = first.split(" ").filter(Boolean);
    const lastTokens = last.split(" ").filter(Boolean);
    const full = [...firstTokens, ...lastTokens];
    const fullReverse = [...lastTokens, ...firstTokens];
    const hasAll = (tokens: string[]) => tokens.length > 0 && tokens.every((token) => queryTokens.has(token));

    let score = 0;
    if (normQuery === [...firstTokens, ...lastTokens].join(" ") || normQuery === [...lastTokens, ...firstTokens].join(" ")) score = 100;
    else if (hasAll(full) || hasAll(fullReverse)) score = 90;
    else {
      const distinctiveTokens = [...firstTokens, ...lastTokens].filter((token) => token.length >= 4);
      const matchedTokens = distinctiveTokens.filter((token) => queryTokens.has(token));
      if (matchedTokens.length) score = 70 + Math.min(20, matchedTokens.length * 5);
    }
    return { player, score };
  }).filter((candidate) => candidate.score > 0).sort((a, b) => b.score - a.score);

  if (!ranked.length || ranked[0]!.score < 70) return null;
  if (ranked.length > 1 && ranked[0]!.score === ranked[1]!.score) return null;
  return ranked[0]!.player;
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
    where: { teamId: match.teamId, status: { not: "ARCHIVED" } },
    select: { id: true, firstName: true, lastName: true, shirtNumber: true, teamId: true }
  });

  // Determine report text to analyze. Explicit human-entered text wins; for
  // FAF imports, analyze the actual official report before the curated public
  // event summary already stored on the match.
  const suppliedReportText = (reportText || "").trim();
  let textToAnalyze = suppliedReportText;
  const fafFinalReport = match.documents.find((document) =>
    document.matchDocumentType === "REFEREE_REPORT" && /^FAF-EMS-.+-final-report-ar\.pdf$/i.test(document.originalName || "")
  );
  const refDoc = fafFinalReport || match.documents.find(
    (document) => document.matchDocumentType === "REFEREE_REPORT"
      || document.name.includes("تقرير حكم")
      || document.name.toLowerCase().includes("rapport")
      || document.originalName?.toLowerCase().includes("referee")
  );
  if (!textToAnalyze && refDoc) {
    // A filename is not report content and must never be fed to the parser as evidence.
    if (refDoc) {
      try {
        const [{ getPrivateFileBuffer }, { extractDocumentText }] = await Promise.all([
          import("@/lib/storage"),
          import("./document-verifier")
        ]);
        const buffer = await getPrivateFileBuffer(refDoc.storageKey);
        textToAnalyze = (await extractDocumentText(buffer, refDoc.mimeType)) || "";
      } catch (error) {
        console.warn("[AI Referee Report] Could not read attached report", error);
      }
    }
  }
  if (!textToAnalyze) textToAnalyze = match.matchReport || "";

  if (!textToAnalyze) {
    return {
      success: false,
      eventsCreated: 0,
      events: [],
      summary: "تعذر استخراج نص مقروء من تقرير الحكم. تحقق من أن الملف واضح ويحتوي على نص أو أعد رفع نسخة أوضح.",
      aiProviderUsed: "INTELLIGENT_NLP_ENGINE"
    };
  }

  let parsedEvents: ParsedEventItem[] = [];
  let detectedScore: { home: number; away: number } | null = null;
  let aiProviderUsed: "CLOUDFLARE_WORKERS_AI" | "LOCAL_OLLAMA" | "INTELLIGENT_NLP_ENGINE" = "INTELLIGENT_NLP_ENGINE";
  let aiFallback: "quota" | "unavailable" | null = null;

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
  if (!availability.available) aiFallback = "unavailable";
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
            const matchedByName = findBestPlayerMatch(e.playerName || "", e.shirtNumber, squad);
            const matchedById = e.playerId ? squad.find((p) => p.id === e.playerId) : undefined;
            const matched = matchedByName || matchedById;

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
          aiProviderUsed = process.env.AI_PROVIDER === "cloudflare" || process.env.DEPLOY_TARGET === "cloudflare" ? "CLOUDFLARE_WORKERS_AI" : "LOCAL_OLLAMA";
        }
      }
    } catch (err) {
      aiFallback = err instanceof AIError && err.code === "AI_QUOTA_EXHAUSTED" ? "quota" : "unavailable";
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
  const newEventsToCreate: ParsedEventItem[] = [];
  for (const candidate of validEvents) {
    const alreadyRecorded = existingEvents.some(
      (event) => event.type === candidate.type && Math.abs(event.minute - candidate.minute) <= 2
        && (event.playerId === candidate.playerId
          || (!event.playerId && normalizeName(event.playerName || "") === normalizeName(candidate.playerName)))
    );
    const duplicatedInReport = newEventsToCreate.some(
      (event) => event.playerId === candidate.playerId && event.type === candidate.type && Math.abs(event.minute - candidate.minute) <= 2
    );
    if (!alreadyRecorded && !duplicatedInReport) newEventsToCreate.push(candidate);
  }

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
      ...(suppliedReportText ? { matchReport: suppliedReportText } : {}),
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
      aiFallback,
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
    aiProviderUsed,
    aiFallback
  };
}
