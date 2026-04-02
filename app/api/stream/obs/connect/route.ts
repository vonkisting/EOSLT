import { auth } from "@/auth";
import { canAccessStream } from "@/lib/stream-access";
import { parseObsRequestCredentials, type ObsJsonBody } from "@/lib/stream-obs-credentials";
import { withObsWebSocket } from "@/lib/stream-obs-with-connection";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/stream/obs/connect
 * Verifies OBS WebSocket credentials by connecting from this server, calling GetVersion, then disconnecting.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !canAccessStream(session.user.email)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: ObsJsonBody;
  try {
    body = (await request.json()) as ObsJsonBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const creds = parseObsRequestCredentials(body);
  if (!creds.ok) {
    return NextResponse.json({ ok: false, error: creds.error }, { status: 400 });
  }

  const result = await withObsWebSocket(creds.host, creds.port, creds.password, async (obs) => {
    return obs.call("GetVersion");
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  const version = result.data;
  return NextResponse.json({
    ok: true,
    obsVersion: version.obsVersion,
    obsWebSocketVersion: version.obsWebSocketVersion,
    platform: version.platform,
  });
}
