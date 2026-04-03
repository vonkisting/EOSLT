/**
 * Optional canonical origin for Stream OBS overlay URLs (browser sources).
 * When unset, the Stream page passes a server-derived origin (LAN IP when Host is loopback), then
 * `window.location.origin` as fallback.
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
