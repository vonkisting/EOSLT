import { auth } from "@/auth";
import { canAccessStream } from "@/lib/stream-access";
import { parseObsRequestCredentials, type ObsJsonBody } from "@/lib/stream-obs-credentials";
import { setImageSourceFileOrCreate } from "@/lib/stream-obs-image-source-file";
import { withObsWebSocket } from "@/lib/stream-obs-with-connection";
import { DEFAULT_STREAM_IMAGE_SOURCE_NAME } from "@/components/stream/streamObsFormDefaults";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = ObsJsonBody & {
  inputName?: string;
  /** Image path or URL for OBS Image Source `file` setting. */
  file?: string;
};

/**
 * POST /api/stream/obs/set-image-source-file
 * Creates an image_source input or sets its `file` URL/path, and ensures it is on the program scene.
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
      : DEFAULT_STREAM_IMAGE_SOURCE_NAME;
  const file = typeof body.file === "string" ? body.file.trim() : "";
  if (!file || file.length > 4096 || /[\r\n]/.test(file)) {
    return NextResponse.json(
      { ok: false, error: "file must be a non-empty string (max 4096 characters)" },
      { status: 400 }
    );
  }

  const result = await withObsWebSocket(creds.host, creds.port, creds.password, async (obs) => {
    await setImageSourceFileOrCreate(obs, inputName, file);
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
