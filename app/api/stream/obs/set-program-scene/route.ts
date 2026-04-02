import { auth } from "@/auth";
import { canAccessStream } from "@/lib/stream-access";
import { parseObsRequestCredentials, type ObsJsonBody } from "@/lib/stream-obs-credentials";
import { withObsWebSocket } from "@/lib/stream-obs-with-connection";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = ObsJsonBody & { sceneName?: string };

/**
 * POST /api/stream/obs/set-program-scene
 * Sets the OBS program scene by name.
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

  const sceneName = typeof body.sceneName === "string" ? body.sceneName.trim() : "";
  if (!sceneName) {
    return NextResponse.json({ ok: false, error: "sceneName is required" }, { status: 400 });
  }

  const result = await withObsWebSocket(creds.host, creds.port, creds.password, async (obs) => {
    await obs.call("SetCurrentProgramScene", { sceneName });
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
