import test from "node:test";
import assert from "node:assert/strict";
import { competitionSchema } from "@/lib/validations/competition";
import {
  getDefaultStandings,
  getDefaultCupBracket,
  normalizeTeamName,
  OFFICIAL_CATEGORY_NAMES,
  rankStandings,
  type StandingTeamEntry
} from "@/lib/competitions";

function sampleStanding(id: string): StandingTeamEntry {
  return {
    id,
    rank: 0,
    teamName: `Team ${id}`,
    isOurClub: false,
    played: 5,
    won: 3,
    drawn: 0,
    lost: 2,
    goalsFor: 8,
    goalsAgainst: 5,
    goalDifference: 3,
    points: 9
  };
}

test("competitionSchema validates LEAGUE and CUP types with logoUrl", () => {
  const leagueValid = competitionSchema.safeParse({
    name: "بطولة القسم الجهوي الثالث",
    type: "LEAGUE",
    seasonId: "season-1",
    teamId: "team-1",
    logoUrl: "/branding/ligue-algerie-logo.svg",
    organization: "LRF Saida"
  });
  assert.equal(leagueValid.success, true);
  if (leagueValid.success) {
    assert.equal(leagueValid.data.type, "LEAGUE");
    assert.equal(leagueValid.data.logoUrl, "/branding/ligue-algerie-logo.svg");
  }

  const cupValid = competitionSchema.safeParse({
    name: "كأس الجزائر",
    type: "CUP",
    seasonId: "season-1",
    teamId: "team-1",
    logoUrl: "/branding/coupe-algerie-logo.svg"
  });
  assert.equal(cupValid.success, true);
  if (cupValid.success) {
    assert.equal(cupValid.data.type, "CUP");
  }
});

test("new competitions start without invented league results", () => {
  assert.deepEqual(getDefaultStandings("SENIOR"), []);
});

test("standings auto-sort by points, goal difference, and goals scored", () => {
  const sampleTeams: StandingTeamEntry[] = [
    {
      id: "1",
      rank: 1,
      teamName: "Team B",
      isOurClub: false,
      played: 5,
      won: 3,
      drawn: 0,
      lost: 2,
      goalsFor: 8,
      goalsAgainst: 6,
      goalDifference: 2,
      points: 9
    },
    {
      id: "2",
      rank: 2,
      teamName: "Team A (Our Club)",
      isOurClub: true,
      played: 5,
      won: 4,
      drawn: 0,
      lost: 1,
      goalsFor: 12,
      goalsAgainst: 4,
      goalDifference: 8,
      points: 12
    },
    {
      id: "3",
      rank: 3,
      teamName: "Team C",
      isOurClub: false,
      played: 5,
      won: 3,
      drawn: 0,
      lost: 2,
      goalsFor: 10,
      goalsAgainst: 5,
      goalDifference: 5,
      points: 9
    }
  ];

  const sorted = rankStandings(sampleTeams);

  assert.equal(sorted[0].teamName, "Team A (Our Club)");
  assert.equal(sorted[1].teamName, "Team C"); // GD +5 vs +2
  assert.equal(sorted[2].teamName, "Team B");
});

test("new cup competitions start without invented fixtures or scores", () => {
  const bracket = getDefaultCupBracket("SENIOR", "أمل سيدي حسني (ESH)");
  assert.deepEqual(bracket, { rounds: [] });
});

test("league standings rank by points, goal difference, goals, and preserve true ties", () => {
  const tied = rankStandings([
    { ...sampleStanding("A"), points: 9, goalDifference: 3, goalsFor: 8 },
    { ...sampleStanding("B"), points: 9, goalDifference: 3, goalsFor: 8 },
    { ...sampleStanding("C"), points: 9, goalDifference: 2, goalsFor: 9 }
  ]);
  assert.equal(tied[0].rank, 1);
  assert.equal(tied[1].rank, 1);
  assert.equal(tied[2].rank, 3);
});

test("normalizeTeamName standardizes Arabic and French opponent names", () => {
  assert.equal(normalizeTeamName("شباب دحموني (CRB Dahmouni)"), "شباب دحموني crb dahmouni");
  assert.equal(normalizeTeamName("  IRB Sougueur  "), "irb sougueur");
});

test("Algeria clock formatter produces 24h format matching HH:mm:ss without am/pm", () => {
  const testDate = new Date("2026-10-04T15:30:45.000Z"); // 15:30 UTC -> 16:30 in Algeria (UTC+1)
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Algiers",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const timeStr = formatter.format(testDate);
  assert.match(timeStr, /^\d{2}:\d{2}:\d{2}$/);
  assert.equal(timeStr.includes("AM") || timeStr.includes("PM") || timeStr.includes("am") || timeStr.includes("pm"), false);
});
