import { auth } from "@/auth";
import { canAccessStream } from "@/lib/stream-access";
import { parseObsRequestCredentials, type ObsJsonBody } from "@/lib/stream-obs-credentials";
import { withObsWebSocket } from "@/lib/stream-obs-with-connection";
import { DEFAULT_SCOREBOARD_BROWSER_SOURCE_NAME } from "@/components/stream/streamObsFormDefaults";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = ObsJsonBody & {
  inputName?: string;
};

/**
 * POST /api/stream/obs/refresh-browser-source
 * Clicks the browser source “Refresh” in OBS (reloads page; picks up Convex-backed overlay changes).
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

  const inputName =
    typeof body.inputName === "string" && body.inputName.trim()
      ? body.inputName.trim().slice(0, 256)
      : DEFAULT_SCOREBOARD_BROWSER_SOURCE_NAME;

  const result = await withObsWebSocket(creds.host, creds.port, creds.password, async (obs) => {
    await obs.call("PressInputPropertiesButton", {
      inputName,
      propertyName: "refreshnocache",
    });
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
