import { auth } from "@/auth";
import { canAccessStream } from "@/lib/stream-access";
import { parseObsRequestCredentials, type ObsJsonBody } from "@/lib/stream-obs-credentials";
import { ensureGraphicsSceneWithOptionalVideo } from "@/lib/stream-obs-graphics-scene";
import { withObsWebSocket } from "@/lib/stream-obs-with-connection";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = ObsJsonBody & {
  sceneName?: string;
  videoUrl?: string;
};

function validateSceneName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || s.length > 256 || /[\r\n]/.test(s)) return null;
  return s;
}

function validateVideoUrl(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== "string") return null;
  const u = raw.trim();
  if (!u || u.length > 4096 || /[\r\n]/.test(u)) return null;
  if (!u.startsWith("https://") && !u.startsWith("http://")) return null;
  return u;
}

/**
 * POST /api/stream/obs/graphics-scene
 * Ensures an OBS scene exists; optionally adds/updates an FFmpeg media source and restarts playback.
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

  const sceneName = validateSceneName(body.sceneName);
  if (!sceneName) {
    return NextResponse.json({ ok: false, error: "sceneName must be a non-empty string (max 256)" }, { status: 400 });
  }

  const videoUrl = validateVideoUrl(body.videoUrl);
  if (videoUrl === null) {
    return NextResponse.json({ ok: false, error: "videoUrl must be http(s) when provided" }, { status: 400 });
  }

  const result = await withObsWebSocket(creds.host, creds.port, creds.password, async (obs) => {
    await ensureGraphicsSceneWithOptionalVideo(obs, sceneName, videoUrl);
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
