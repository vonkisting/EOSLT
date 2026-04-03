/**
 * Where OBS WebSocket calls run from the Next.js stream dashboard (client-side only).
 *
 * - **Server** (default locally): API routes open WebSocket from the Node host (works on LAN/Tailscale
 *   when that host can route to OBS).
 * - **Browser** (default on Vercel): WebSocket opens from the user’s machine, which can reach
 *   Tailscale IPs if the browser runs on a Tailscale-connected device.
 *
 * Override: `NEXT_PUBLIC_STREAM_OBS_TRANSPORT=server` | `browser`
 *
 * On Vercel builds, `next.config.ts` sets `NEXT_PUBLIC_STREAM_OBS_VERCEL=1` so this returns true in the browser.
 */
export function streamObsUseBrowserTransport(): boolean {
  if (typeof window === "undefined") return false;
  const explicit = process.env.NEXT_PUBLIC_STREAM_OBS_TRANSPORT?.trim().toLowerCase();
  if (explicit === "server") return false;
  if (explicit === "browser") return true;
  return process.env.NEXT_PUBLIC_STREAM_OBS_VERCEL === "1";
}
