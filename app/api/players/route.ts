import {
  getLeagueGuidByNameAndSeason,
  getPlayersByLeagueGuid,
} from "@/lib/poolhub-queries";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/players?leagueName=...&season=...
 * 1) Get the selected league's GUID from Leagues (WHERE Name + Season match).
 * 2) Return only players whose LeagueGUID equals that GUID.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const leagueName = searchParams.get("leagueName");
  const season = searchParams.get("season");
  if (!leagueName || !season) {
    return NextResponse.json(
      { error: "leagueName and season are required" },
      { status: 400 }
    );
  }
  const selectedLeagueGuid = await getLeagueGuidByNameAndSeason(leagueName, season);
  if (!selectedLeagueGuid) {
    return NextResponse.json({ leagueGuid: null, players: [] });
  }
  const players = await getPlayersByLeagueGuid(selectedLeagueGuid);
  return NextResponse.json({ leagueGuid: selectedLeagueGuid, players });
}
