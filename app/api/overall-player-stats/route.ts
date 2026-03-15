import { getOverallPlayerStatsByLeagueGuid } from "@/lib/poolhub-queries";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/overall-player-stats?leagueGuid=...
 * Returns all rows from OverallPlayerStats where LeagueGUID matches.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const leagueGuid = searchParams.get("leagueGuid");
  if (!leagueGuid) {
    return NextResponse.json(
      { error: "leagueGuid is required" },
      { status: 400 }
    );
  }
  const rows = await getOverallPlayerStatsByLeagueGuid(leagueGuid);
  return NextResponse.json(rows);
}
