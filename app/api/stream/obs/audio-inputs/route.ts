import { auth } from "@/auth";
import { canAccessStream } from "@/lib/stream-access";
import { parseObsRequestCredentials, type ObsJsonBody } from "@/lib/stream-obs-credentials";
import { obsVolumeDbToUiPercent } from "@/lib/stream-obs-volume-ui";
import { withObsWebSocket } from "@/lib/stream-obs-with-connection";
import type { OBSWebSocket } from "obs-websocket-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type InputRow = { inputName: string; inputKind: string };

function parseInputRows(raw: unknown): InputRow[] {
  if (!Array.isArray(raw)) return [];
  const out: InputRow[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const inputName = typeof o.inputName === "string" ? o.inputName : "";
    if (!inputName) continue;
    const inputKind = typeof o.inputKind === "string" ? o.inputKind : "";
    out.push({ inputName, inputKind });
  }
  return out;
}

async function audioInputsForObs(obs: OBSWebSocket): Promise<
  Array<{ inputName: string; inputKind: string; volume: number; muted: boolean }>
> {
  const list = await obs.call("GetInputList");
  const rows = parseInputRows(list.inputs);
  const out: Array<{ inputName: string; inputKind: string; volume: number; muted: boolean }> = [];

  for (const row of rows) {
    try {
      const vol = await obs.call("GetInputVolume", { inputName: row.inputName });
      const mute = await obs.call("GetInputMute", { inputName: row.inputName });
      const db = typeof vol.inputVolumeDb === "number" ? vol.inputVolumeDb : -60;
      out.push({
        inputName: row.inputName,
        inputKind: row.inputKind,
        volume: obsVolumeDbToUiPercent(db),
        muted: mute.inputMuted === true,
      });
    } catch {
      /* input has no volume control (not an audio source) */
    }
  }

  out.sort((a, b) => a.inputName.localeCompare(b.inputName, undefined, { sensitivity: "base" }));
  return out;
}

/**
 * POST /api/stream/obs/audio-inputs
 * Lists OBS inputs that support volume/mute (audio-capable sources).
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
    audioInputsForObs(obs)
  );

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, inputs: result.data });
}
