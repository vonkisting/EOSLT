import fs from "node:fs";
import path from "node:path";
import { auth } from "@/auth";
import {
  STREAM_GRAPHICS_ALLOWED_EXTENSIONS,
  listStreamGraphicsBasenames,
} from "@/lib/stream-graphics-assets";
import { formatStreamSfxButtonLabel, isSafeStreamSfxBasename } from "@/lib/stream-sfx-basename";
import { canAccessStream } from "@/lib/stream-access";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 200 * 1024 * 1024;

function sanitizeBasenameFromOriginalName(originalName: string): string {
  const withoutExt = path.basename(originalName, path.extname(originalName));
  let s = withoutExt
    .trim()
    .replace(/[^a-zA-Z0-9 _\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  if (s.length === 0) {
    s = `clip_${Date.now()}`;
    if (s.length > 120) s = s.slice(0, 120);
  }
  return s;
}

function basenameTakenCaseInsensitive(id: string, existing: string[]): boolean {
  const lower = id.toLowerCase();
  return existing.some((e) => e.toLowerCase() === lower);
}

/**
 * POST /api/stream/graphics/upload (multipart field `file`)
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email || !canAccessStream(session.user.email)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Missing file" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "File too large" }, { status: 400 });
  }

  const ext = path.extname(file.name).toLowerCase();
  if (!STREAM_GRAPHICS_ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json(
      { ok: false, error: "Unsupported type; use mp4, webm, mov, mkv, or m4v." },
      { status: 400 },
    );
  }

  const id = sanitizeBasenameFromOriginalName(file.name);
  if (!isSafeStreamSfxBasename(id)) {
    return NextResponse.json({ ok: false, error: "Invalid name" }, { status: 400 });
  }

  const existing = listStreamGraphicsBasenames();
  if (basenameTakenCaseInsensitive(id, existing)) {
    return NextResponse.json(
      { ok: false, error: "A graphic with this name already exists" },
      { status: 409 },
    );
  }

  const dir = path.join(process.cwd(), "public", "stream-graphics");
  fs.mkdirSync(dir, { recursive: true });
  const diskName = `${id}${ext}`;
  const abs = path.join(dir, diskName);

  const buf = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(abs, buf);

  return NextResponse.json({
    ok: true,
    id,
    label: formatStreamSfxButtonLabel(id),
  });
}
