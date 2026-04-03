import { headers } from "next/headers";
import { networkInterfaces } from "node:os";

/**
 * First non-internal IPv4 on this machine (dev server), for OBS on another LAN host.
 */
function pickFirstLanIPv4(): string | null {
  for (const nets of Object.values(networkInterfaces())) {
    if (!nets) continue;
    for (const net of nets) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return null;
}

function isLoopbackHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1";
}

function parseHostHeader(hostHeader: string): { hostname: string; port: string } {
  const raw = hostHeader.trim().split(/\s*,\s*/)[0] ?? "";
  if (!raw) return { hostname: "", port: "" };

  if (raw.startsWith("[")) {
    const end = raw.indexOf("]");
    if (end === -1) return { hostname: "", port: "" };
    const hostname = raw.slice(1, end);
    const rest = raw.slice(end + 1);
    const port = rest.startsWith(":") ? rest.slice(1) : "";
    return { hostname, port };
  }

  const lastColon = raw.lastIndexOf(":");
  if (lastColon > 0 && /^\d{1,5}$/.test(raw.slice(lastColon + 1))) {
    return { hostname: raw.slice(0, lastColon), port: raw.slice(lastColon + 1) };
  }
  return { hostname: raw, port: "" };
}

/**
 * Public origin of this Next.js server as seen by the current request, adjusted so OBS on the LAN
 * can load overlays: if you opened the app via localhost, the hostname is replaced with this host’s LAN IPv4.
 * Call only from a server component or route handler (uses `headers()`).
 */
export async function getStreamRequestOverlayOrigin(): Promise<string | null> {
  const h = await headers();
  const hostHeader = h.get("x-forwarded-host") ?? h.get("host");
  if (!hostHeader) return null;

  const proto = h.get("x-forwarded-proto") === "https" ? "https" : "http";
  const { hostname, port } = parseHostHeader(hostHeader);
  if (!hostname) return null;

  let displayHost = hostname;
  if (isLoopbackHost(hostname)) {
    const lan = pickFirstLanIPv4();
    if (lan) displayHost = lan;
  }

  const needsBrackets = displayHost.includes(":") && !displayHost.startsWith("[");
  const hostPart = needsBrackets ? `[${displayHost}]` : displayHost;

  const defaultPort = proto === "https" ? "443" : "80";
  const effectivePort = port || defaultPort;
  const omitPort =
    (proto === "http" && effectivePort === "80") ||
    (proto === "https" && effectivePort === "443");

  if (omitPort) {
    return `${proto}://${hostPart}`;
  }
  return `${proto}://${hostPart}:${effectivePort}`;
}
