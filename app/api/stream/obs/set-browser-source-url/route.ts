import { auth } from "@/auth";
import { canAccessStream } from "@/lib/stream-access";
import { parseObsRequestCredentials, type ObsJsonBody } from "@/lib/stream-obs-credentials";
import {
  setBrowserSourceUrlOrCreate,
  type BrowserSourcePixelSize,
} from "@/lib/stream-obs-browser-source-url";
import { withObsWebSocket } from "@/lib/stream-obs-with-connection";
import { DEFAULT_GENERIC_BROWSER_SOURCE_NAME } from "@/components/stream/streamObsFormDefaults";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = ObsJsonBody & {
  inputName?: string;
  url?: string;
  browserWidth?: number;
  browserHeight?: number;
};

/**
 * POST /api/stream/obs/set-browser-source-url
 * Ensures at least one scene (creates "Overlay" if none), then creates the browser source or sets its URL.
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
      : DEFAULT_GENERIC_BROWSER_SOURCE_NAME;
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url || (!url.startsWith("https://") && !url.startsWith("http://"))) {
    return NextResponse.json({ ok: false, error: "url must be an http(s) URL" }, { status: 400 });
  }

  const bw = body.browserWidth;
  const bh = body.browserHeight;
  let pixelSize: BrowserSourcePixelSize | undefined;
  if (bw !== undefined || bh !== undefined) {
    if (typeof bw !== "number" || typeof bh !== "number" || !Number.isFinite(bw) || !Number.isFinite(bh)) {
      return NextResponse.json(
        { ok: false, error: "browserWidth and browserHeight must be finite numbers when provided" },
        { status: 400 }
      );
    }
    const width = Math.round(bw);
    const height = Math.round(bh);
    if (width < 64 || width > 4096 || height < 64 || height > 4096) {
      return NextResponse.json(
        { ok: false, error: "browser dimensions must be between 64 and 4096 px" },
        { status: 400 }
      );
    }
    pixelSize = { width, height };
  }

  const result = await withObsWebSocket(creds.host, creds.port, creds.password, async (obs) => {
    await setBrowserSourceUrlOrCreate(obs, inputName, url, pixelSize);
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
