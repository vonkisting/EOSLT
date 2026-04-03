import { buildObsWebSocketUrl, parseObsPort } from "@/lib/stream-obs-url";
import type { OBSWebSocket as OBSWebSocketJson } from "obs-websocket-js/json";

const CONNECT_TIMEOUT_MS = 12_000;

/**
 * Short-lived OBS WebSocket from the browser (mirrors {@link withObsWebSocket} on the server).
 */
export async function withObsWebSocketBrowser<T>(
  host: string,
  port: number,
  password: string,
  work: (obs: OBSWebSocketJson) => Promise<T>
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  if (typeof window === "undefined") {
    return { ok: false, error: "OBS browser WebSocket is only available in the browser." };
  }
  const url = buildObsWebSocketUrl(host, port);
  if (!url) {
    return { ok: false, error: "Invalid host" };
  }

  const { default: OBSWebSocket } = await import("obs-websocket-js/json");
  const obs = new OBSWebSocket();
  try {
    await Promise.race([
      obs.connect(url, password, { rpcVersion: 1 }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Connection timed out")), CONNECT_TIMEOUT_MS);
      }),
    ]);
    const data = await work(obs);
    return { ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not connect to OBS";
    return { ok: false, error: message };
  } finally {
    try {
      await obs.disconnect();
    } catch {
      /* ignore */
    }
  }
}

/** Parses port string from UI; returns error message if invalid. */
export function obsPortOrError(portRaw: string): { ok: true; port: number } | { ok: false; error: string } {
  const port = parseObsPort(portRaw);
  if (port == null) {
    return { ok: false, error: "Invalid port" };
  }
  return { ok: true, port };
}
