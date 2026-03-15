import { getSeasonsByLeagueName } from "@/lib/poolhub-queries";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/seasons?leagueName=... – returns distinct Season values from Leagues
 * where Name matches the selected league (for the Season dropdown).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const leagueName = searchParams.get("leagueName");
  if (!leagueName) {
    return NextResponse.json(
      { error: "leagueName is required" },
      { status: 400 }
    );
  }
  const seasons = await getSeasonsByLeagueName(leagueName);
  return NextResponse.json(seasons);
}
