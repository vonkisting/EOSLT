import fs from "node:fs";
import path from "node:path";
import { isSafeStreamSfxBasename } from "@/lib/stream-sfx-basename";

/**
 * Basenames (no `.mp3`) of files in `public/stream-sfx/`. Server-only.
 */
export function listStreamSfxMp3Basenames(): string[] {
  const dir = path.join(process.cwd(), "public", "stream-sfx");
  try {
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .map((f) => path.basename(f))
      .filter((f) => f.toLowerCase().endsWith(".mp3"))
      .map((f) => f.slice(0, -4).trim())
      .filter((b) => b.length > 0 && isSafeStreamSfxBasename(b))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  } catch {
    return [];
  }
}
