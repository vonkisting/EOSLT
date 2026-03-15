import { getLeagueNames } from "@/lib/poolhub-queries";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/leagues – returns distinct league names from PoolHub Leagues table (column Name).
 */
export async function GET() {
  const names = await getLeagueNames();
  return NextResponse.json(names);
}
