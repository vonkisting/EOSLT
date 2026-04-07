/**
 * Shared rules for stream SFX ids (basename without extension under `public/stream-sfx/`).
 * Spaces allowed (e.g. `Crowd Cheer`). No path or Windows-reserved characters.
 * Keep `convex/streamSfxBasename.ts` aligned with this pattern.
 */
const SAFE_BASENAME = /^[a-zA-Z0-9 _\-]{1,120}$/;

export function isSafeStreamSfxBasename(id: string): boolean {
  return SAFE_BASENAME.test(id);
}

/** Button copy: hyphens → spaces, title case each word. */
export function formatStreamSfxButtonLabel(basename: string): string {
  const words = basename
    .replace(/-/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Direct URL when the file is known to be `.mp3` (static hosting). */
export function streamSfxPublicUrl(basename: string): string | null {
  if (!isSafeStreamSfxBasename(basename)) return null;
  return `/stream-sfx/${encodeURIComponent(basename)}.mp3`;
}

/**
 * Overlay audio source: resolves extension on the server (supports uploaded non-mp3 clips).
 */
export function streamSfxPlayApiUrl(basename: string): string | null {
  if (!isSafeStreamSfxBasename(basename)) return null;
  return `/api/stream/sfx/play?soundId=${encodeURIComponent(basename)}`;
}

/** Optional cap on how long a clip may play in the overlay (ms). */
export function streamSfxMaxPlayMs(basename: string): number | undefined {
  const key = basename.toLowerCase().replace(/\s+/g, " ").trim();
  if (key === "crowd cheer" || key === "crowd-cheer") return 6000;
  return undefined;
}
