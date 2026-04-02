import { auth } from "@/auth";
import { canAccessStream } from "@/lib/stream-access";
import { parseObsRequestCredentials, type ObsJsonBody } from "@/lib/stream-obs-credentials";
import { uiPercentToObsVolumeDb } from "@/lib/stream-obs-volume-ui";
import { withObsWebSocket } from "@/lib/stream-obs-with-connection";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = ObsJsonBody & {
  inputName?: string;
  volume?: number;
};

/**
 * POST /api/stream/obs/set-input-volume
 * Sets mixer volume for one input (`volume` 0–100 UI → dB).
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

  const inputName = typeof body.inputName === "string" ? body.inputName.trim() : "";
  if (!inputName) {
    return NextResponse.json({ ok: false, error: "inputName is required" }, { status: 400 });
  }
  const volume = typeof body.volume === "number" && Number.isFinite(body.volume) ? body.volume : null;
  if (volume == null || volume < 0 || volume > 100) {
    return NextResponse.json({ ok: false, error: "volume must be 0–100" }, { status: 400 });
  }

  const inputVolumeDb = uiPercentToObsVolumeDb(volume);

  const result = await withObsWebSocket(creds.host, creds.port, creds.password, async (obs) => {
    await obs.call("SetInputVolume", { inputName, inputVolumeDb });
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
