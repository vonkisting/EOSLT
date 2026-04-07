import fs from "node:fs";
import { NextResponse } from "next/server";
import {
  STREAM_SFX_CONTENT_TYPE,
  resolveStreamSfxFilenameForId,
  streamSfxFileAbsolutePath,
} from "@/lib/stream-sfx-assets";
import { isSafeStreamSfxBasename } from "@/lib/stream-sfx-basename";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/stream/sfx/play?soundId=<basename>
 * Serves a clip from `public/stream-sfx/` for the OBS overlay (no auth; only known ids resolve).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const soundId = url.searchParams.get("soundId")?.trim() ?? "";
  if (!soundId || !isSafeStreamSfxBasename(soundId)) {
    return NextResponse.json({ error: "Invalid soundId" }, { status: 400 });
  }

  const filename = resolveStreamSfxFilenameForId(soundId);
  if (!filename) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const abs = streamSfxFileAbsolutePath(filename);
  if (!abs || !fs.existsSync(abs)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  const contentType = STREAM_SFX_CONTENT_TYPE[ext] ?? "application/octet-stream";

  const buf = fs.readFileSync(abs);
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
