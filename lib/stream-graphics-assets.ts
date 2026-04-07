import fs from "node:fs";
import path from "node:path";
import { isSafeStreamSfxBasename } from "@/lib/stream-sfx-basename";

const STREAM_GRAPHICS_EXT_ORDER = [".mp4", ".webm", ".mov", ".mkv", ".m4v"] as const;

export const STREAM_GRAPHICS_ALLOWED_EXTENSIONS = new Set<string>(STREAM_GRAPHICS_EXT_ORDER);

export const STREAM_GRAPHICS_CONTENT_TYPE: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".m4v": "video/x-m4v",
};

function extPreference(ext: string): number {
  const i = STREAM_GRAPHICS_EXT_ORDER.indexOf(ext as (typeof STREAM_GRAPHICS_EXT_ORDER)[number]);
  return i === -1 ? 999 : i;
}

function streamGraphicsDir(): string {
  return path.join(process.cwd(), "public", "stream-graphics");
}

export function listStreamGraphicsBasenames(): string[] {
  const dir = streamGraphicsDir();
  try {
    if (!fs.existsSync(dir)) return [];
    const files = fs.readdirSync(dir).map((f) => path.basename(f));
    const byId = new Map<string, { filename: string; pref: number }>();
    for (const f of files) {
      const lower = f.toLowerCase();
      const matchedExt = STREAM_GRAPHICS_EXT_ORDER.find((e) => lower.endsWith(e));
      if (!matchedExt) continue;
      const base = f.slice(0, -matchedExt.length);
      if (!isSafeStreamSfxBasename(base)) continue;
      const pref = extPreference(matchedExt);
      const cur = byId.get(base);
      if (!cur || pref < cur.pref) byId.set(base, { filename: f, pref });
    }
    return Array.from(byId.keys()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  } catch {
    return [];
  }
}

export function resolveStreamGraphicsFilenameForId(graphicId: string): string | null {
  if (!isSafeStreamSfxBasename(graphicId)) return null;
  const dir = streamGraphicsDir();
  try {
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir).map((f) => path.basename(f));
    let best: { filename: string; pref: number } | null = null;
    for (const f of files) {
      const lower = f.toLowerCase();
      const matchedExt = STREAM_GRAPHICS_EXT_ORDER.find((e) => lower.endsWith(e));
      if (!matchedExt) continue;
      const base = f.slice(0, -matchedExt.length);
      if (base !== graphicId) continue;
      const pref = extPreference(matchedExt);
      if (!best || pref < best.pref) best = { filename: f, pref };
    }
    return best?.filename ?? null;
  } catch {
    return null;
  }
}

export function streamGraphicsFileAbsolutePath(filename: string): string | null {
  const base = path.basename(filename);
  if (base !== filename || !STREAM_GRAPHICS_ALLOWED_EXTENSIONS.has(path.extname(base).toLowerCase())) {
    return null;
  }
  const dir = streamGraphicsDir();
  const full = path.join(dir, base);
  const resolvedDir = path.resolve(dir);
  const resolvedFile = path.resolve(full);
  if (!resolvedFile.startsWith(resolvedDir + path.sep) && resolvedFile !== resolvedDir) {
    return null;
  }
  return resolvedFile;
}
