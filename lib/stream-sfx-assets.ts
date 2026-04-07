import fs from "node:fs";
import path from "node:path";
import { isSafeStreamSfxBasename } from "@/lib/stream-sfx-basename";

/** Prefer these extensions when multiple files share the same basename. */
const STREAM_SFX_EXT_ORDER = [".mp3", ".wav", ".ogg", ".webm", ".m4a", ".aac"] as const;

export const STREAM_SFX_ALLOWED_EXTENSIONS = new Set<string>(STREAM_SFX_EXT_ORDER);

export const STREAM_SFX_CONTENT_TYPE: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".webm": "audio/webm",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
};

function extPreference(ext: string): number {
  const i = STREAM_SFX_EXT_ORDER.indexOf(ext as (typeof STREAM_SFX_EXT_ORDER)[number]);
  return i === -1 ? 999 : i;
}

function streamSfxDir(): string {
  return path.join(process.cwd(), "public", "stream-sfx");
}

/**
 * Lists safe SFX ids (filename without extension) under `public/stream-sfx/`.
 * If both `foo.mp3` and `foo.wav` exist, the file with the preferred extension wins.
 */
export function listStreamSfxBasenames(): string[] {
  const dir = streamSfxDir();
  try {
    if (!fs.existsSync(dir)) return [];
    const files = fs.readdirSync(dir).map((f) => path.basename(f));
    const byId = new Map<string, { filename: string; pref: number }>();
    for (const f of files) {
      const lower = f.toLowerCase();
      const matchedExt = STREAM_SFX_EXT_ORDER.find((e) => lower.endsWith(e));
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

/**
 * Resolves a cue `soundId` to the on-disk filename in `public/stream-sfx/`.
 */
export function resolveStreamSfxFilenameForId(soundId: string): string | null {
  if (!isSafeStreamSfxBasename(soundId)) return null;
  const dir = streamSfxDir();
  try {
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir).map((f) => path.basename(f));
    let best: { filename: string; pref: number } | null = null;
    for (const f of files) {
      const lower = f.toLowerCase();
      const matchedExt = STREAM_SFX_EXT_ORDER.find((e) => lower.endsWith(e));
      if (!matchedExt) continue;
      const base = f.slice(0, -matchedExt.length);
      if (base !== soundId) continue;
      const pref = extPreference(matchedExt);
      if (!best || pref < best.pref) best = { filename: f, pref };
    }
    return best?.filename ?? null;
  } catch {
    return null;
  }
}

export function streamSfxFileAbsolutePath(filename: string): string | null {
  const base = path.basename(filename);
  if (base !== filename || !STREAM_SFX_ALLOWED_EXTENSIONS.has(path.extname(base).toLowerCase())) {
    return null;
  }
  const dir = streamSfxDir();
  const full = path.join(dir, base);
  const resolvedDir = path.resolve(dir);
  const resolvedFile = path.resolve(full);
  if (!resolvedFile.startsWith(resolvedDir + path.sep) && resolvedFile !== resolvedDir) {
    return null;
  }
  return resolvedFile;
}
