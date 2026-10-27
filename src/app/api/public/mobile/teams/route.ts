import { NextResponse } from "next/server";
import { getPublicTeams } from "@/lib/public/teams";
import { frenchPublicCategory, frenchPublicClubName, frenchPublicText } from "@/lib/public/locale-text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const locale = new URL(request.url).searchParams.get("locale") === "fr" ? "fr" : "ar";
  const teams = await getPublicTeams();
  return NextResponse.json({ teams: teams.map((team) => ({
    ...team,
    name: locale === "fr" ? frenchPublicClubName(team.name, frenchPublicCategory(team.category)) : team.name,
    description: locale === "fr" ? frenchPublicText(team.description, "") : team.description
  })) }, { headers: { "Cache-Control": "no-store" } });
}
