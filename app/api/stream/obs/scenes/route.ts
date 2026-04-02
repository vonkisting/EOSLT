import { auth } from "@/auth";
import { canAccessStream } from "@/lib/stream-access";
import { parseObsRequestCredentials, type ObsJsonBody } from "@/lib/stream-obs-credentials";
import { normalizeSceneNames } from "@/lib/stream-obs-scene-list";
import { withObsWebSocket } from "@/lib/stream-obs-with-connection";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/stream/obs/scenes
 * Lists OBS scenes and current program scene name.
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
    const list = await obs.call("GetSceneList");
    return {
      sceneNames: normalizeSceneNames(list.scenes),
      currentProgramSceneName:
        typeof list.currentProgramSceneName === "string" && list.currentProgramSceneName
          ? list.currentProgramSceneName
          : null,
    };
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    scenes: result.data.sceneNames,
    currentProgramSceneName: result.data.currentProgramSceneName,
  });
}
