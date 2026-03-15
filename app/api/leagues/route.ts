import { getLeagueNames } from "@/lib/poolhub-queries";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type LeaguesResponse = { leagues: string[]; error?: string };

/**
 * GET /api/leagues – returns distinct league names from PoolHub Leagues table (column Name).
 * When POOLHUB_DATABASE_URL is not set or the database is unreachable, returns { leagues: [], error }.
 */
export async function GET() {
  if (!process.env.POOLHUB_DATABASE_URL) {
    return NextResponse.json<LeaguesResponse>({
      leagues: [],
      error:
        "POOLHUB_DATABASE_URL is not configured. Set it in your deployment environment to load league names.",
    });
  }
  try {
    const names = await getLeagueNames();
    return NextResponse.json<LeaguesResponse>({ leagues: names ?? [] });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to connect to PoolHub database. Check POOLHUB_DATABASE_URL and server logs.";
    return NextResponse.json<LeaguesResponse>({ leagues: [], error: message });
  }
}
