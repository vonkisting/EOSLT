import { getVenueNames } from "@/lib/poolhub-queries";
import { filterVenueNames } from "@/lib/venue-exclusions";
import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/sync-venues – fetch venues from PoolHub (with exclusions), write to Convex.
 * Run once to populate Convex; after that the app loads venues from Convex only.
 */
export async function POST() {
  const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!CONVEX_URL) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_CONVEX_URL not set" },
      { status: 500 }
    );
  }
  try {
    const names = await getVenueNames();
    const filtered = filterVenueNames(names);
    const { api } = await import("@/convex/_generated/api");
    const client = new ConvexHttpClient(CONVEX_URL);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await client.mutation(api.venues.setAll as any, { names: filtered });
    return NextResponse.json({
      ok: true,
      count: filtered.length,
      message: `Synced ${filtered.length} venues to Convex.`,
    });
  } catch (err) {
    console.error("[sync-venues]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
