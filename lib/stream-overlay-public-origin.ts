/**
 * Optional canonical origin for Stream OBS overlay URLs (browser sources).
 * Without it, the dashboard uses `window.location.origin`, which embeds your current LAN IP
 * in copied URLs — after Wi‑Fi changes, OBS still loads the old address and SFX/scoreboard break.
 */
export function getStreamOverlayPublicOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_STREAM_OVERLAY_ORIGIN?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}
