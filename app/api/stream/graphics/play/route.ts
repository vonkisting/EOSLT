import fs from "node:fs";
import { NextResponse } from "next/server";
import {
  STREAM_GRAPHICS_CONTENT_TYPE,
  resolveStreamGraphicsFilenameForId,
  streamGraphicsFileAbsolutePath,
} from "@/lib/stream-graphics-assets";
import { isSafeStreamSfxBasename } from "@/lib/stream-sfx-basename";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/stream/graphics/play?graphicId=<basename>
 * Serves a clip from `public/stream-graphics/` for OBS Media Source (HTTP URL).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const graphicId = url.searchParams.get("graphicId")?.trim() ?? "";
  if (!graphicId || !isSafeStreamSfxBasename(graphicId)) {
    return NextResponse.json({ error: "Invalid graphicId" }, { status: 400 });
  }

  const filename = resolveStreamGraphicsFilenameForId(graphicId);
  if (!filename) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const abs = streamGraphicsFileAbsolutePath(filename);
  if (!abs || !fs.existsSync(abs)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  const contentType = STREAM_GRAPHICS_CONTENT_TYPE[ext] ?? "application/octet-stream";

  const buf = fs.readFileSync(abs);
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
      "Accept-Ranges": "bytes",
    },
  });
}
