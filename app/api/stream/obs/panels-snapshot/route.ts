import { auth } from "@/auth";
import { canAccessStream } from "@/lib/stream-access";
import { buildObsPanelsSnapshot } from "@/lib/stream-obs-panels-snapshot";
import { parseObsRequestCredentials, type ObsJsonBody } from "@/lib/stream-obs-credentials";
import { withObsWebSocket } from "@/lib/stream-obs-with-connection";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/stream/obs/panels-snapshot
 * Scenes, scene items, and audio inputs in one WebSocket session (avoids OBS "new connection" spam).
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

  const result = await withObsWebSocket(creds.host, creds.port, creds.password, (obs) =>
    buildObsPanelsSnapshot(obs)
  );

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  const d = result.data;
  return NextResponse.json({
    ok: true,
    scenes: d.sceneNames,
    currentProgramSceneName: d.currentProgramSceneName,
    items: d.items,
    inputs: d.audioInputs,
  });
}
