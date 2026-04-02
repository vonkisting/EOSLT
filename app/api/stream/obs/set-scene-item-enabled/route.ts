import { auth } from "@/auth";
import { canAccessStream } from "@/lib/stream-access";
import { parseObsRequestCredentials, type ObsJsonBody } from "@/lib/stream-obs-credentials";
import { withObsWebSocket } from "@/lib/stream-obs-with-connection";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = ObsJsonBody & {
  sceneName?: string;
  sceneItemId?: number;
  sceneItemEnabled?: boolean;
};

/**
 * POST /api/stream/obs/set-scene-item-enabled
 * Sets visibility (enabled) for one scene item in a named scene.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !canAccessStream(session.user.email)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const creds = parseObsRequestCredentials(body);
  if (!creds.ok) {
    return NextResponse.json({ ok: false, error: creds.error }, { status: 400 });
  }

  const sceneName = typeof body.sceneName === "string" ? body.sceneName : "";
  if (!sceneName) {
    return NextResponse.json({ ok: false, error: "sceneName is required" }, { status: 400 });
  }
  const sceneItemId = typeof body.sceneItemId === "number" && body.sceneItemId >= 0 ? body.sceneItemId : null;
  if (sceneItemId == null) {
    return NextResponse.json({ ok: false, error: "sceneItemId is required" }, { status: 400 });
  }
  if (typeof body.sceneItemEnabled !== "boolean") {
    return NextResponse.json({ ok: false, error: "sceneItemEnabled must be a boolean" }, { status: 400 });
  }
  const sceneItemEnabled = body.sceneItemEnabled;

  const result = await withObsWebSocket(creds.host, creds.port, creds.password, async (obs) => {
    await obs.call("SetSceneItemEnabled", {
      sceneName,
      sceneItemId,
      sceneItemEnabled,
    });
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
