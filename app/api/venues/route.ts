import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/venues – returns venue names from Convex (used by legacy consumers if any).
 * Dashboard loads from Convex via useQuery(api.venues.list).
 */
export async function GET() {
  const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!CONVEX_URL) {
    return NextResponse.json([], { status: 200 });
  }
  try {
    const { api } = await import("@/convex/_generated/api");
    const client = new ConvexHttpClient(CONVEX_URL);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const names = await client.query(api.venues.list as any);
    return NextResponse.json(Array.isArray(names) ? names : []);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
