import { buildObsWebSocketUrl, parseObsPort } from "@/lib/stream-obs-url";

export type ObsJsonBody = {
  host?: string;
  port?: string | number;
  password?: string;
};

/**
 * Parses host/port/password from an OBS API POST body (same shape as /connect).
 */
export function parseObsRequestCredentials(body: ObsJsonBody):
  | { ok: true; host: string; port: number; password: string }
  | { ok: false; error: string } {
  const port = parseObsPort(body.port);
  if (port == null) {
    return { ok: false, error: "Invalid port (use 1–65535)" };
  }
  const host = typeof body.host === "string" ? body.host.trim() : "";
  if (!host) {
    return { ok: false, error: "Host is required" };
  }
  if (!buildObsWebSocketUrl(host, port)) {
    return { ok: false, error: "Invalid host (no scheme; use IP or hostname)" };
  }
  const password = typeof body.password === "string" ? body.password : "";
  return { ok: true, host, port, password };
}
